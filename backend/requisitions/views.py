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

        serializer = ApprovalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action   = serializer.validated_data['action']
        comments = serializer.validated_data.get('comments', '')

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
        elif action == RequisitionApproval.Action.RETURNED:
            req.status = StaffRequisition.Status.SUBMITTED

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
