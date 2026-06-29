from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.utils import timezone
from django.db import models as db_models
from .models import StaffRequisition, RequisitionApproval, MaintenanceSchedule, FuelPaymentRecord
from .serializers import (
    StaffRequisitionSerializer, StaffRequisitionListSerializer,
    StaffRequisitionCreateSerializer, ApprovalActionSerializer,
    MaintenanceScheduleSerializer, MaintenanceScheduleCreateSerializer,
    FuelPaymentRecordSerializer, ScheduleApproveSerializer,
)

# ── Role sets ──────────────────────────────────────────────────────────────────
APPROVER_ROLES       = {'managing_director', 'system_admin'}
ALL_VIEWER_ROLES     = {
    'managing_director', 'general_manager', 'admin_officer',
    'finance_officer', 'finance_manager', 'system_admin', 'procurement_officer',
}
SITE_STAFF_ROLES     = {'site_engineer', 'site_foreman', 'site_surveyor'}
FINANCE_ROLES        = {'finance_officer', 'finance_manager', 'system_admin', 'managing_director'}
SCHEDULE_LOGGER_ROLES = {'site_manager', 'admin_officer', 'system_admin', 'managing_director', 'general_manager'}
SCHEDULE_APPROVER_ROLES = {'admin_officer', 'system_admin', 'managing_director'}


def _req_queryset(user):
    role = getattr(user, 'role', None)
    if role in ALL_VIEWER_ROLES:
        return StaffRequisition.objects.all()
    if role == 'site_manager':
        from django.contrib.auth import get_user_model
        User = get_user_model()
        site_staff_ids = User.objects.filter(role__in=SITE_STAFF_ROLES).values_list('id', flat=True)
        return StaffRequisition.objects.filter(
            db_models.Q(requested_by=user) | db_models.Q(requested_by_id__in=site_staff_ids)
        )
    return StaffRequisition.objects.filter(requested_by=user)


class RequisitionListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return StaffRequisitionCreateSerializer
        return StaffRequisitionListSerializer

    def get_queryset(self):
        qs = _req_queryset(self.request.user)
        params = self.request.query_params
        if params.get('status'):
            qs = qs.filter(status=params['status'])
        if params.get('req_type'):
            qs = qs.filter(req_type=params['req_type'])
        return qs.select_related('requested_by', 'project').prefetch_related('maintenance_schedule')

    def perform_create(self, serializer):
        serializer.save()


class RequisitionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = StaffRequisitionSerializer

    def get_queryset(self):
        return _req_queryset(self.request.user).select_related(
            'requested_by', 'project', 'department',
        ).prefetch_related(
            'items', 'approvals__approved_by',
            'maintenance_schedule', 'fuel_payment',
        )


class RequisitionApproveView(APIView):
    """Only the MD (managing_director) or system_admin can approve requisitions."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        user_role = getattr(request.user, 'role', None)
        if user_role not in APPROVER_ROLES:
            return Response(
                {'detail': 'Only the Managing Director can approve requisitions.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            req = _req_queryset(request.user).get(pk=pk)
        except StaffRequisition.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        if req.status not in {StaffRequisition.Status.SUBMITTED, StaffRequisition.Status.MD_REVIEW,
                               StaffRequisition.Status.DEPT_REVIEW, StaffRequisition.Status.FINANCE}:
            return Response(
                {'detail': f'Cannot act on a requisition with status: {req.status}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
            req.status = StaffRequisition.Status.APPROVED
        elif action == RequisitionApproval.Action.REJECTED:
            req.status = StaffRequisition.Status.REJECTED
            req.rejection_reason = comments
        elif action == RequisitionApproval.Action.RETURNED:
            req.status = StaffRequisition.Status.SUBMITTED

        req.save(update_fields=['status', 'rejection_reason'])
        return Response(StaffRequisitionSerializer(req).data)


class RequisitionRecallView(APIView):
    """Original requester can withdraw a submitted requisition back to draft."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            req = StaffRequisition.objects.get(pk=pk, requested_by=request.user)
        except StaffRequisition.DoesNotExist:
            return Response({'detail': 'Not found or not your requisition.'}, status=status.HTTP_404_NOT_FOUND)

        if req.status not in {StaffRequisition.Status.SUBMITTED}:
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
        user_role = getattr(request.user, 'role', None)
        if user_role not in ALL_VIEWER_ROLES:
            return Response({'detail': 'Not authorised.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            req = StaffRequisition.objects.get(pk=pk, status=StaffRequisition.Status.APPROVED)
        except StaffRequisition.DoesNotExist:
            return Response({'detail': 'Not found or not approved.'}, status=status.HTTP_404_NOT_FOUND)

        req.status            = StaffRequisition.Status.FULFILLED
        req.fulfilled_by      = request.user
        req.fulfilled_at      = timezone.now()
        req.fulfillment_notes = request.data.get('notes', '')
        req.save(update_fields=['status', 'fulfilled_by', 'fulfilled_at', 'fulfillment_notes'])
        return Response(StaffRequisitionSerializer(req).data)


class PendingApprovalsView(generics.ListAPIView):
    """List all requisitions awaiting MD approval."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = StaffRequisitionListSerializer

    def get_queryset(self):
        user_role = getattr(self.request.user, 'role', None)
        if user_role not in APPROVER_ROLES:
            return StaffRequisition.objects.none()
        return StaffRequisition.objects.filter(
            status=StaffRequisition.Status.SUBMITTED
        ).select_related('requested_by', 'project')


# ── Maintenance Schedule ───────────────────────────────────────────────────────

class MaintenanceScheduleListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return MaintenanceScheduleCreateSerializer if self.request.method == 'POST' else MaintenanceScheduleSerializer

    def get_queryset(self):
        user_role = getattr(self.request.user, 'role', None)
        qs = MaintenanceSchedule.objects.select_related(
            'requisition', 'logged_by', 'approved_by'
        )
        if user_role in ALL_VIEWER_ROLES | {'site_manager'}:
            return qs
        # Regular users: only schedules from their own requisitions
        return qs.filter(requisition__requested_by=self.request.user)

    def create(self, request, *args, **kwargs):
        user_role = getattr(request.user, 'role', None)
        if user_role not in SCHEDULE_LOGGER_ROLES:
            return Response(
                {'detail': 'Only site managers or admin can log a maintenance schedule.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)


class MaintenanceScheduleDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = MaintenanceScheduleSerializer

    def get_queryset(self):
        user_role = getattr(self.request.user, 'role', None)
        qs = MaintenanceSchedule.objects.select_related(
            'requisition', 'logged_by', 'approved_by'
        )
        if user_role in ALL_VIEWER_ROLES | {'site_manager'}:
            return qs
        return qs.filter(requisition__requested_by=self.request.user)

    def update(self, request, *args, **kwargs):
        user_role = getattr(request.user, 'role', None)
        schedule  = self.get_object()
        if user_role not in SCHEDULE_LOGGER_ROLES:
            return Response({'detail': 'Not authorised.'}, status=status.HTTP_403_FORBIDDEN)
        if schedule.status in {'approved', 'completed', 'cancelled'}:
            return Response(
                {'detail': 'Cannot edit a schedule that is approved, completed, or cancelled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)


class MaintenanceScheduleApproveView(APIView):
    """Admin approves (or cancels) a maintenance schedule, triggering a finance claim."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        user_role = getattr(request.user, 'role', None)
        if user_role not in SCHEDULE_APPROVER_ROLES:
            return Response(
                {'detail': 'Only admin can approve maintenance schedules.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            schedule = MaintenanceSchedule.objects.select_related('requisition').get(pk=pk)
        except MaintenanceSchedule.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ScheduleApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        action   = serializer.validated_data['action']
        comments = serializer.validated_data.get('comments', '')

        if action == 'cancelled':
            schedule.status        = MaintenanceSchedule.Status.CANCELLED
            schedule.admin_comments = comments
            schedule.save(update_fields=['status', 'admin_comments'])
            return Response(MaintenanceScheduleSerializer(schedule).data)

        # Approve: create finance expense claim
        schedule.status        = MaintenanceSchedule.Status.APPROVED
        schedule.admin_comments = comments
        schedule.approved_by   = request.user
        schedule.approved_at   = timezone.now()

        if schedule.payment_amount and not schedule.expense_claim_id:
            try:
                from finance.models import ExpenseClaim, ExpenseClaimItem
                req = schedule.requisition
                claim = ExpenseClaim.objects.create(
                    title=f'Maintenance: {req.title}',
                    submitted_by=req.requested_by,
                    project=req.project,
                    total_amount=schedule.payment_amount,
                    notes=(
                        f'Auto-created from maintenance schedule for {req.reference_number}. '
                        f'Assigned to: {schedule.assigned_to or "TBD"}. '
                        f'Payment details: {schedule.payment_details or "N/A"}'
                    ),
                    status='submitted',
                    requisition=req,
                )
                ExpenseClaimItem.objects.create(
                    claim=claim,
                    date=timezone.localdate(),
                    description=schedule.work_description or req.title,
                    amount=schedule.payment_amount,
                    category='overhead',
                    receipt_ref=req.reference_number,
                )
                schedule.expense_claim = claim
            except Exception:
                pass  # Finance claim creation is best-effort

        schedule.save(update_fields=['status', 'admin_comments', 'approved_by', 'approved_at', 'expense_claim'])
        return Response(MaintenanceScheduleSerializer(schedule).data)


# ── Fuel Payment ───────────────────────────────────────────────────────────────

class FuelPaymentView(APIView):
    """Finance records payment for an approved fuel requisition."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        user_role = getattr(request.user, 'role', None)
        if user_role not in FINANCE_ROLES:
            return Response(
                {'detail': 'Only finance can record fuel payments.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            req = StaffRequisition.objects.get(pk=pk, req_type=StaffRequisition.ReqType.FUEL)
        except StaffRequisition.DoesNotExist:
            return Response({'detail': 'Not found or not a fuel requisition.'}, status=status.HTTP_404_NOT_FOUND)

        if req.status not in {StaffRequisition.Status.APPROVED, StaffRequisition.Status.FULFILLED}:
            return Response({'detail': 'Fuel requisition must be approved first.'}, status=status.HTTP_400_BAD_REQUEST)

        if hasattr(req, 'fuel_payment'):
            return Response({'detail': 'Payment already recorded for this requisition.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = FuelPaymentRecordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Create expense claim in finance
        expense_claim = None
        try:
            from finance.models import ExpenseClaim, ExpenseClaimItem
            claim = ExpenseClaim.objects.create(
                title=f'Fuel: {req.title}',
                submitted_by=req.requested_by,
                project=req.project,
                total_amount=data['amount_paid'],
                notes=(
                    f'Fuel payment for {req.reference_number}. '
                    f'Mode: {data["payment_mode"]}. '
                    f'Ref: {data.get("payment_ref", "N/A")}'
                ),
                status='submitted',
                requisition=req,
            )
            ExpenseClaimItem.objects.create(
                claim=claim,
                date=timezone.localdate(),
                description=req.title,
                amount=data['amount_paid'],
                category='overhead',
                receipt_ref=data.get('payment_ref', req.reference_number),
            )
            expense_claim = claim
        except Exception:
            pass

        record = FuelPaymentRecord.objects.create(
            requisition=req,
            payment_mode=data['payment_mode'],
            amount_paid=data['amount_paid'],
            payment_ref=data.get('payment_ref', ''),
            notes=data.get('notes', ''),
            expense_claim=expense_claim,
            created_by=request.user,
        )
        return Response(FuelPaymentRecordSerializer(record).data, status=status.HTTP_201_CREATED)
