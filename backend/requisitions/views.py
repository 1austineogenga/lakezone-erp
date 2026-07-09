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
STAGE1_APPROVER_ROLES = {'admin_officer', 'system_admin'}   # first-level review for facility_manager reqs
ALL_VIEWER_ROLES     = {
    'managing_director', 'general_manager', 'admin_officer',
    'finance_officer', 'finance_manager', 'system_admin', 'procurement_officer',
}
SITE_STAFF_ROLES     = {'site_engineer', 'site_foreman', 'site_surveyor'}
FINANCE_ROLES        = {'finance_officer', 'finance_manager', 'system_admin', 'managing_director'}
SCHEDULE_LOGGER_ROLES = {'site_manager', 'admin_officer', 'system_admin', 'managing_director', 'general_manager'}
SCHEDULE_APPROVER_ROLES = {'managing_director', 'system_admin'}


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
        params = self.request.query_params
        if params.get('mine') == 'true':
            qs = StaffRequisition.objects.filter(requested_by=self.request.user)
        else:
            qs = _req_queryset(self.request.user)
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
    """
    Two-stage approval for facility_manager requisitions:
      submitted → admin_officer approves → dept_review → MD approves → approved
    All other requisitions go directly: submitted → MD approves → approved
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        user_role = getattr(request.user, 'role', None)
        is_md     = user_role in APPROVER_ROLES
        is_stage1 = user_role in STAGE1_APPROVER_ROLES

        if not is_md and not is_stage1:
            return Response(
                {'detail': 'You are not authorised to approve requisitions.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        try:
            req = StaffRequisition.objects.get(pk=pk)
        except StaffRequisition.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        from_facility_manager = getattr(req.requested_by, 'role', None) == 'facility_manager'

        # Determine what this user is allowed to act on
        if is_stage1 and not is_md:
            # Admin officer: can only act on facility_manager reqs at submitted stage
            if not from_facility_manager or req.status != StaffRequisition.Status.SUBMITTED:
                return Response(
                    {'detail': 'You can only review submitted facility manager requisitions.'},
                    status=status.HTTP_403_FORBIDDEN,
                )
        elif is_md:
            # MD: acts on dept_review (from facility_manager flow) or submitted (all others)
            allowed = {StaffRequisition.Status.SUBMITTED, StaffRequisition.Status.MD_REVIEW,
                       StaffRequisition.Status.DEPT_REVIEW, StaffRequisition.Status.FINANCE}
            if req.status not in allowed:
                return Response(
                    {'detail': f'Cannot act on a requisition with status: {req.status}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # MD should not act on facility_manager reqs still at submitted (admin_officer hasn't reviewed yet)
            if from_facility_manager and req.status == StaffRequisition.Status.SUBMITTED:
                return Response(
                    {'detail': 'This requisition must first be reviewed by the Admin Officer.'},
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
            if is_stage1 and not is_md and from_facility_manager:
                # Stage 1 approved: pass to MD
                req.status = StaffRequisition.Status.DEPT_REVIEW
            else:
                req.status = StaffRequisition.Status.APPROVED
        elif action == RequisitionApproval.Action.REJECTED:
            req.status = StaffRequisition.Status.REJECTED
            req.rejection_reason = comments
        elif action == RequisitionApproval.Action.RETURNED:
            req.status = StaffRequisition.Status.SUBMITTED

        req.save(update_fields=['status', 'rejection_reason'])

        # Notify relevant parties of status change
        try:
            from notifications.signals import notify
            from notifications.models import Notification
            req_link = f"/requisitions/{req.pk}"
            requester = req.requested_by
            if req.status == StaffRequisition.Status.APPROVED:
                notify(requester, Notification.Type.REQ_APPROVED,
                       f"Requisition {req.reference_number} Approved",
                       f"Your requisition '{req.title}' has been approved.", req_link)
            elif req.status == StaffRequisition.Status.REJECTED:
                notify(requester, Notification.Type.REQ_REJECTED,
                       f"Requisition {req.reference_number} Rejected",
                       f"Your requisition '{req.title}' was rejected. Reason: {comments or 'No reason given.'}", req_link)
            elif req.status == StaffRequisition.Status.DEPT_REVIEW:
                notify(requester, Notification.Type.REQ_DEPT_REVIEW,
                       f"Requisition {req.reference_number} Forwarded to MD",
                       f"Your requisition '{req.title}' has been reviewed and forwarded to the MD for final approval.", req_link)
        except Exception:
            pass

        # Auto-create ExpenseClaim in Finance when fully approved
        if req.status == StaffRequisition.Status.APPROVED:
            try:
                from finance.models import ExpenseClaim
                if not ExpenseClaim.objects.filter(requisition=req).exists():
                    payment_note = ''
                    if req.payment_method == 'mpesa_paybill':
                        payment_note = (f'M-Pesa Paybill — Business No: {req.payment_business_number}, '
                                        f'Account No: {req.payment_account_number}')
                    elif req.payment_method == 'mpesa_till':
                        payment_note = f'M-Pesa Till — Till No: {req.payment_till_number}'
                    elif req.payment_method == 'mpesa_send_money':
                        payment_note = f'M-Pesa Send Money — Phone: {req.payment_send_money_phone}'
                    elif req.payment_method == 'bank_transfer':
                        payment_note = (f'Bank Transfer — Bank: {req.payment_bank_name}, '
                                        f'Account Name: {req.payment_account_name}, '
                                        f'Account No: {req.payment_account_number}, '
                                        f'Branch: {req.payment_branch_name}')
                    notes = '\n'.join(filter(None, [payment_note, req.description]))
                    ExpenseClaim.objects.create(
                        title=req.title,
                        submitted_by=req.requested_by,
                        project=req.project,
                        requisition=req,
                        status='submitted',
                        total_amount=req.total_amount,
                        notes=notes or f'Auto-created from requisition {req.reference_number}',
                    )
            except Exception:
                pass  # Never block approval if expense claim creation fails

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

        try:
            from notifications.signals import notify
            from notifications.models import Notification
            notify(req.requested_by, Notification.Type.REQ_FULFILLED,
                   f"Requisition {req.reference_number} Fulfilled",
                   f"Your requisition '{req.title}' has been fulfilled.",
                   f"/requisitions/{req.pk}")
        except Exception:
            pass

        # Auto-log fleet maintenance when a repair_maintenance requisition is fulfilled
        if req.req_type == StaffRequisition.ReqType.REPAIR_MAINTENANCE and req.fleet_vehicle_no:
            try:
                from fleet.models import Vehicle, VehicleMaintenance
                vehicle = Vehicle.objects.filter(vehicle_no=req.fleet_vehicle_no).first()
                if vehicle:
                    # Map requisition priority/title to maintenance type
                    title_lower = req.title.lower()
                    if 'tyre' in title_lower or 'tire' in title_lower:
                        maint_type = 'tyre'
                    elif 'oil' in title_lower:
                        maint_type = 'oil'
                    elif 'inspect' in title_lower or 'certif' in title_lower:
                        maint_type = 'inspection'
                    elif 'repair' in title_lower or 'engine' in title_lower or 'brake' in title_lower \
                            or 'hydraulic' in title_lower or 'electrical' in title_lower \
                            or 'transmission' in title_lower or 'weld' in title_lower:
                        maint_type = 'repair'
                    elif 'service' in title_lower or 'routine' in title_lower:
                        maint_type = 'service'
                    else:
                        maint_type = 'other'

                    # Try to get cost and performed_by from the linked maintenance schedule
                    sched = getattr(req, 'maintenance_schedule', None)
                    cost = sched.payment_amount if sched and sched.payment_amount else req.total_amount
                    performed_by = sched.assigned_to if sched and sched.assigned_to else (
                        req.fulfillment_notes[:200] if req.fulfillment_notes else ''
                    )
                    description = req.description or req.title

                    VehicleMaintenance.objects.create(
                        vehicle=vehicle,
                        maintenance_type=maint_type,
                        description=f'[Auto from {req.reference_number}] {description}',
                        date=req.fulfilled_at.date(),
                        cost=cost or 0,
                        performed_by=performed_by,
                        notes=req.fulfillment_notes or '',
                    )
            except Exception:
                pass  # Never block fulfillment if fleet logging fails

        return Response(StaffRequisitionSerializer(req).data)


def _auto_log_fleet_maintenance(req):
    """Shared helper — auto-create VehicleMaintenance when a repair_maintenance req is fulfilled."""
    if req.req_type != StaffRequisition.ReqType.REPAIR_MAINTENANCE or not req.fleet_vehicle_no:
        return
    try:
        from fleet.models import Vehicle, VehicleMaintenance
        vehicle = Vehicle.objects.filter(vehicle_no=req.fleet_vehicle_no).first()
        if not vehicle:
            return
        title_lower = req.title.lower()
        if 'tyre' in title_lower or 'tire' in title_lower:
            maint_type = 'tyre'
        elif 'oil' in title_lower:
            maint_type = 'oil'
        elif 'inspect' in title_lower or 'certif' in title_lower:
            maint_type = 'inspection'
        elif any(k in title_lower for k in ('repair', 'engine', 'brake', 'hydraulic', 'electrical', 'transmission', 'weld')):
            maint_type = 'repair'
        elif 'service' in title_lower or 'routine' in title_lower:
            maint_type = 'service'
        else:
            maint_type = 'other'
        sched = getattr(req, 'maintenance_schedule', None)
        cost = sched.payment_amount if sched and sched.payment_amount else req.total_amount
        performed_by = sched.assigned_to if sched and sched.assigned_to else (req.fulfillment_notes[:200] if req.fulfillment_notes else '')
        if not VehicleMaintenance.objects.filter(
            vehicle=vehicle,
            description__startswith=f'[Auto from {req.reference_number}]'
        ).exists():
            VehicleMaintenance.objects.create(
                vehicle=vehicle,
                maintenance_type=maint_type,
                description=f'[Auto from {req.reference_number}] {req.description or req.title}',
                date=req.fulfilled_at.date(),
                cost=cost or 0,
                performed_by=performed_by,
                notes=req.fulfillment_notes or '',
            )
    except Exception:
        pass


class RequisitionConfirmPaymentView(APIView):
    """Finance confirms payment → status: paid → auto fulfilled."""
    permission_classes = [permissions.IsAuthenticated]
    CONFIRM_ROLES = ['finance_officer', 'finance_manager', 'system_admin']

    def post(self, request, pk):
        user_role = getattr(request.user, 'role', None)
        if user_role not in self.CONFIRM_ROLES:
            return Response({'detail': 'Only Finance or MD can confirm payment.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            req = StaffRequisition.objects.get(pk=pk, status=StaffRequisition.Status.APPROVED)
        except StaffRequisition.DoesNotExist:
            return Response({'detail': 'Requisition not found or not in approved state.'}, status=status.HTTP_404_NOT_FOUND)

        paid_mode = request.data.get('paid_mode', 'finance_raised')
        notes     = request.data.get('notes', '')
        now       = timezone.now()

        # Mark as paid then immediately fulfilled (single transaction)
        req.paid_by                 = request.user
        req.paid_at                 = now
        req.paid_mode               = paid_mode
        req.payment_confirmed_notes = notes
        req.status                  = StaffRequisition.Status.FULFILLED
        req.fulfilled_by            = request.user
        req.fulfilled_at            = now
        req.fulfillment_notes       = notes
        req.save(update_fields=[
            'paid_by', 'paid_at', 'paid_mode', 'payment_confirmed_notes',
            'status', 'fulfilled_by', 'fulfilled_at', 'fulfillment_notes',
        ])

        # Mark the linked expense claim as paid
        try:
            from finance.models import ExpenseClaim
            claim = ExpenseClaim.objects.filter(requisition=req).first()
            if claim and claim.status not in ('paid',):
                claim.status      = 'paid'
                claim.reviewed_by = request.user
                claim.reviewed_at = now
                claim.review_notes = notes or f'Payment confirmed by {request.user.get_full_name()}'
                claim.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_notes'])
        except Exception:
            pass

        _auto_log_fleet_maintenance(req)

        try:
            from notifications.signals import notify
            from notifications.models import Notification
            notify(req.requested_by, Notification.Type.REQ_FULFILLED,
                   f"Requisition {req.reference_number} Payment Confirmed",
                   f"Payment for your requisition '{req.title}' has been confirmed and it is now fulfilled.",
                   f"/requisitions/{req.pk}")
        except Exception:
            pass

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
