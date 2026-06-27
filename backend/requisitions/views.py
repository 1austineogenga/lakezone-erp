from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from .models import StaffRequisition, RequisitionApproval
from .serializers import (
    StaffRequisitionSerializer, StaffRequisitionCreateSerializer,
    ApprovalActionSerializer,
)

MD_THRESHOLD      = 1_000_000
FINANCE_THRESHOLD = 200_000

ROLE_STAGE_MAP = {
    'department_manager': StaffRequisition.Status.DEPT_REVIEW,
    'hod':                StaffRequisition.Status.DEPT_REVIEW,
    'finance_officer':    StaffRequisition.Status.FINANCE,
    'finance_manager':    StaffRequisition.Status.FINANCE,
    'managing_director':  StaffRequisition.Status.MD_REVIEW,
}

# Roles authorised to act at each approval stage
STAGE_ALLOWED_ROLES = {
    StaffRequisition.Status.SUBMITTED:   {'department_manager', 'hod', 'admin', 'superuser', 'system_admin'},
    StaffRequisition.Status.DEPT_REVIEW: {'finance_officer', 'finance_manager', 'admin', 'superuser', 'system_admin'},
    StaffRequisition.Status.FINANCE:     {'managing_director', 'general_manager', 'admin', 'superuser', 'system_admin'},
    StaffRequisition.Status.MD_REVIEW:   {'managing_director', 'general_manager', 'admin', 'superuser', 'system_admin'},
}


def next_stage(req):
    amount = req.total_amount
    if req.status == StaffRequisition.Status.SUBMITTED:
        return StaffRequisition.Status.DEPT_REVIEW
    if req.status == StaffRequisition.Status.DEPT_REVIEW:
        if amount >= FINANCE_THRESHOLD:
            return StaffRequisition.Status.FINANCE
        if amount >= MD_THRESHOLD:
            return StaffRequisition.Status.MD_REVIEW
        return StaffRequisition.Status.APPROVED
    if req.status == StaffRequisition.Status.FINANCE:
        if amount >= MD_THRESHOLD:
            return StaffRequisition.Status.MD_REVIEW
        return StaffRequisition.Status.APPROVED
    if req.status == StaffRequisition.Status.MD_REVIEW:
        return StaffRequisition.Status.APPROVED
    return req.status


def _check_budget(req):
    """Return (ok, error_message). Checks project budget remaining vs requisition total."""
    if not req.project_id:
        return True, None
    from projects.models import Budget, BudgetLineItem
    from django.db.models import Sum
    approved_budgets = Budget.objects.filter(project=req.project, status='approved')
    if not approved_budgets.exists():
        return True, None  # No approved budget — nothing to check against

    total_budget = BudgetLineItem.objects.filter(
        budget__in=approved_budgets
    ).aggregate(total=Sum('amount'))['total'] or 0

    already_committed = StaffRequisition.objects.filter(
        project=req.project,
        status__in=[
            StaffRequisition.Status.APPROVED,
            StaffRequisition.Status.FULFILLED,
        ],
    ).exclude(pk=req.pk).aggregate(total=Sum('total_amount'))['total'] or 0

    remaining = float(total_budget) - float(already_committed)
    if float(req.total_amount) > remaining:
        return False, (
            f'Requisition total ({req.total_amount}) exceeds remaining project '
            f'budget ({remaining:.2f}). Cannot approve.'
        )
    return True, None


class RequisitionListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return StaffRequisitionCreateSerializer
        return StaffRequisitionSerializer

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)
        privileged = {
            'department_manager', 'hod', 'finance_officer', 'finance_manager',
            'managing_director', 'admin', 'superuser',
        }
        if role in privileged:
            qs = StaffRequisition.objects.all()
        else:
            qs = StaffRequisition.objects.filter(requested_by=user)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        serializer.save()


class RequisitionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = StaffRequisitionSerializer

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)
        privileged = {
            'department_manager', 'hod', 'finance_officer', 'finance_manager',
            'managing_director', 'admin', 'superuser',
        }
        if role in privileged:
            return StaffRequisition.objects.all()
        return StaffRequisition.objects.filter(requested_by=user)


class RequisitionApproveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            req = StaffRequisition.objects.get(pk=pk)
        except StaffRequisition.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Role-based authorization for the current stage
        user_role = getattr(request.user, 'role', None)
        allowed_roles = STAGE_ALLOWED_ROLES.get(req.status, set())
        if user_role not in allowed_roles:
            return Response(
                {'detail': f'Your role ({user_role}) is not authorised to act at stage {req.status}.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = ApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action   = serializer.validated_data['action']
        comments = serializer.validated_data.get('comments', '')

        # Budget check before approving
        if action == RequisitionApproval.Action.APPROVED:
            ok, err = _check_budget(req)
            if not ok:
                return Response({'detail': err}, status=status.HTTP_400_BAD_REQUEST)

        RequisitionApproval.objects.create(
            requisition=req,
            stage=req.status,
            action=action,
            approved_by=request.user,
            comments=comments,
        )

        if action == RequisitionApproval.Action.APPROVED:
            req.status = next_stage(req)
        elif action == RequisitionApproval.Action.REJECTED:
            req.status = StaffRequisition.Status.REJECTED
            req.rejection_reason = comments
        elif action == RequisitionApproval.Action.RETURNED:
            req.status = StaffRequisition.Status.SUBMITTED

        req.save(update_fields=['status', 'rejection_reason'])
        return Response(StaffRequisitionSerializer(req).data)


class RequisitionRecallView(APIView):
    """Allow the original requester to withdraw a SUBMITTED or DEPT_REVIEW requisition."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            req = StaffRequisition.objects.get(pk=pk)
        except StaffRequisition.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if req.requested_by != request.user:
            return Response(
                {'detail': 'Only the original requester can recall this requisition.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        recallable = {StaffRequisition.Status.SUBMITTED, StaffRequisition.Status.DEPT_REVIEW}
        if req.status not in recallable:
            return Response(
                {'detail': f'Cannot recall a requisition in status: {req.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        req.status = StaffRequisition.Status.DRAFT
        req.save(update_fields=['status'])
        return Response(StaffRequisitionSerializer(req).data)


class RequisitionFulfillView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            req = StaffRequisition.objects.get(pk=pk, status=StaffRequisition.Status.APPROVED)
        except StaffRequisition.DoesNotExist:
            return Response({'detail': 'Not found or not approved.'}, status=status.HTTP_404_NOT_FOUND)

        req.status           = StaffRequisition.Status.FULFILLED
        req.fulfilled_by     = request.user
        req.fulfilled_at     = timezone.now()
        req.fulfillment_notes = request.data.get('notes', '')
        req.save(update_fields=['status', 'fulfilled_by', 'fulfilled_at', 'fulfillment_notes'])
        return Response(StaffRequisitionSerializer(req).data)


class MyPendingApprovalsView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = StaffRequisitionSerializer

    def get_queryset(self):
        role = getattr(self.request.user, 'role', None)
        stage = ROLE_STAGE_MAP.get(role)
        if not stage:
            return StaffRequisition.objects.none()
        return StaffRequisition.objects.filter(status=stage)
