from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Notification, ScheduledAction, ActionComment, ComplianceRenewalCase, ComplianceCaseStep, DeviceToken
from .serializers import (
    NotificationSerializer, ScheduledActionSerializer, ActionCommentSerializer,
    ComplianceRenewalCaseSerializer,
)


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user)[:50]


@api_view(["POST", "PATCH"])
@permission_classes([IsAuthenticated])
def mark_read(request, pk):
    try:
        n = Notification.objects.get(pk=pk, recipient=request.user)
        n.is_read = True
        n.save(update_fields=["is_read"])
        return Response({"status": "ok"})
    except Notification.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_notification(request, pk):
    try:
        n = Notification.objects.get(pk=pk, recipient=request.user)
        n.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
    except Notification.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_all_read(request):
    Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
    return Response({"status": "ok"})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def register_device_token(request):
    token = request.data.get("token")
    platform = request.data.get("platform", "android")
    if not token:
        return Response({"error": "token required"}, status=status.HTTP_400_BAD_REQUEST)
    DeviceToken.objects.update_or_create(token=token, defaults={"user": request.user, "platform": platform})
    return Response({"status": "ok"})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def unread_count(request):
    count = Notification.objects.filter(recipient=request.user, is_read=False).count()
    return Response({"count": count})


# ── Compliance Alerts ──────────────────────────────────────────────────────────

def _alert_level(days_left):
    if days_left < 0:
        return 'expired'
    if days_left <= 3:
        return 'critical'
    if days_left <= 7:
        return 'warning'
    return 'ok'


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def compliance_alerts(request):
    """Return all compliance records (fleet + assets) with expiry info."""
    from datetime import date

    today = date.today()
    result = []

    # ── Fleet vehicle compliance ──────────────────────────────────────────────
    try:
        from fleet.models import VehicleCompliance
        records = VehicleCompliance.objects.select_related('vehicle').filter(
            expiry_date__isnull=False
        ).exclude(status='not_applicable').order_by('expiry_date')

        for rec in records:
            days_left = (rec.expiry_date - today).days
            result.append({
                'id':               f'fleet-{rec.id}',
                'source':           'fleet',
                'asset_name':       rec.vehicle.vehicle_name or rec.vehicle.vehicle_no,
                'asset_ref':        rec.vehicle.vehicle_no,
                'compliance_type':  rec.compliance_type,
                'expiry_date':      str(rec.expiry_date),
                'days_left':        days_left,
                'alert_level':      _alert_level(days_left),
                'notes':            rec.notes,
            })
    except Exception:
        pass

    # ── Asset certificates ────────────────────────────────────────────────────
    try:
        from inventory.models import Asset

        CERT_FIELDS = [
            ('insurance',      'insurance_expiry',           'Insurance Certificate'),
            ('inspection',     'inspection_cert_expiry',     'Inspection Certificate'),
            ('speed_governor', 'speed_governor_cert_expiry', 'Speed Governor Certificate'),
        ]

        for asset in Asset.objects.all():
            for cert_key, field, label in CERT_FIELDS:
                expiry = getattr(asset, field, None)
                if not expiry:
                    continue
                days_left = (expiry - today).days
                result.append({
                    'id':               f'asset-{asset.id}-{cert_key}',
                    'source':           'asset',
                    'asset_name':       asset.name,
                    'asset_ref':        asset.asset_code,
                    'compliance_type':  cert_key,
                    'compliance_label': label,
                    'expiry_date':      str(expiry),
                    'days_left':        days_left,
                    'alert_level':      _alert_level(days_left),
                    'notes':            None,
                })
    except Exception:
        pass

    result.sort(key=lambda x: x['days_left'])
    return Response(result)


# ── Scheduled Actions ──────────────────────────────────────────────────────────

class ScheduledActionListCreateView(generics.ListCreateAPIView):
    serializer_class   = ScheduledActionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        from django.db.models import Q
        qs     = ScheduledAction.objects.select_related('created_by', 'assigned_to').prefetch_related('comments')
        status_f  = self.request.query_params.get('status')
        priority_f = self.request.query_params.get('priority')
        if status_f:
            qs = qs.filter(status=status_f)
        if priority_f:
            qs = qs.filter(priority=priority_f)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ScheduledActionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = ScheduledAction.objects.prefetch_related('comments')
    serializer_class   = ScheduledActionSerializer
    permission_classes = [IsAuthenticated]


class ActionCommentCreateView(generics.CreateAPIView):
    serializer_class   = ActionCommentSerializer
    permission_classes = [IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)


# ── Compliance Renewal Cases ───────────────────────────────────────────────────

class ComplianceCaseListCreateView(generics.ListCreateAPIView):
    serializer_class = ComplianceRenewalCaseSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ComplianceRenewalCase.objects.select_related(
            'vehicle_compliance', 'assigned_to', 'created_by', 'bill'
        ).prefetch_related('steps__actioned_by')
        ct = self.request.query_params.get('compliance_type')
        st = self.request.query_params.get('status')
        if ct:
            qs = qs.filter(compliance_type=ct)
        if st:
            qs = qs.filter(status=st)
        return qs

    def perform_create(self, serializer):
        # Accept vehicle_compliance_id to link the fleet record
        vc_id = self.request.data.get('vehicle_compliance_id')
        vc = None
        if vc_id:
            from fleet.models import VehicleCompliance
            try:
                vc = VehicleCompliance.objects.get(pk=vc_id)
            except VehicleCompliance.DoesNotExist:
                pass
        case = serializer.save(created_by=self.request.user, vehicle_compliance=vc)
        # Log the opening step
        ComplianceCaseStep.objects.create(
            case=case,
            step=ComplianceRenewalCase.STEP_OPEN,
            note=self.request.data.get('note', ''),
            actioned_by=self.request.user,
        )


class ComplianceCaseDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = ComplianceRenewalCaseSerializer
    permission_classes = [IsAuthenticated]
    queryset = ComplianceRenewalCase.objects.select_related(
        'vehicle_compliance', 'assigned_to', 'created_by', 'bill'
    ).prefetch_related('steps__actioned_by')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def advance_compliance_case(request, pk):
    """Advance a compliance case to the next step, applying step-specific data."""
    from django.utils import timezone as tz
    try:
        case = ComplianceRenewalCase.objects.get(pk=pk)
    except ComplianceRenewalCase.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    next_step = case.next_step()
    if not next_step:
        return Response({'detail': 'Case is already closed.'}, status=status.HTTP_400_BAD_REQUEST)

    note = request.data.get('note', '')

    # Apply step-specific fields
    if next_step == ComplianceRenewalCase.STEP_ACK:
        assigned_to_id = request.data.get('assigned_to')
        if assigned_to_id:
            case.assigned_to_id = assigned_to_id

    elif next_step == ComplianceRenewalCase.STEP_CONTACTED:
        case.provider_name    = request.data.get('provider_name', case.provider_name)
        case.provider_contact = request.data.get('provider_contact', case.provider_contact)
        case.contacted_date   = request.data.get('contacted_date') or case.contacted_date

    elif next_step == ComplianceRenewalCase.STEP_INVOICE:
        case.invoice_ref      = request.data.get('invoice_ref', case.invoice_ref)
        case.invoice_amount   = request.data.get('invoice_amount', case.invoice_amount)
        case.invoice_due_date = request.data.get('invoice_due_date') or case.invoice_due_date

    elif next_step == ComplianceRenewalCase.STEP_CERT:
        new_expiry      = request.data.get('new_expiry')
        new_cert_number = request.data.get('new_cert_number', '')
        if not new_expiry:
            return Response({'detail': 'new_expiry is required for this step.'}, status=status.HTTP_400_BAD_REQUEST)
        case.new_expiry      = new_expiry
        case.new_cert_number = new_cert_number
        # Update the vehicle compliance record
        if case.vehicle_compliance:
            vc = case.vehicle_compliance
            vc.expiry_date = new_expiry
            vc.status      = 'valid'
            vc.notes       = new_cert_number or vc.notes
            vc.save(update_fields=['expiry_date', 'status', 'notes'])
        # Also update asset fields if linked
        _update_asset_cert(case)

    elif next_step == ComplianceRenewalCase.STEP_CLOSED:
        case.closed_at = tz.now()

    case.status = next_step
    case.save()

    ComplianceCaseStep.objects.create(
        case=case,
        step=next_step,
        note=note,
        actioned_by=request.user,
    )

    serializer = ComplianceRenewalCaseSerializer(case)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_compliance_bill(request, pk):
    """Create a Finance Bill from a compliance case invoice and link it."""
    try:
        case = ComplianceRenewalCase.objects.get(pk=pk)
    except ComplianceRenewalCase.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

    if case.bill_id:
        return Response({'detail': 'Bill already created for this case.'}, status=status.HTTP_400_BAD_REQUEST)

    if not case.invoice_amount:
        return Response({'detail': 'Invoice amount is required before creating a bill.'}, status=status.HTTP_400_BAD_REQUEST)

    supplier_id = request.data.get('supplier_id')
    if not supplier_id:
        return Response({'detail': 'supplier_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

    from procurement.models import Supplier
    try:
        supplier = Supplier.objects.get(pk=supplier_id)
    except Supplier.DoesNotExist:
        return Response({'detail': 'Supplier not found.'}, status=status.HTTP_404_NOT_FOUND)

    from finance.models import Bill
    from datetime import date, timedelta

    cert_labels = {
        'insurance': 'Insurance Renewal',
        'inspection': 'Inspection Certificate',
        'speed_governor': 'Speed Governor Certificate',
    }
    label = cert_labels.get(case.compliance_type, 'Compliance Renewal')

    bill = Bill.objects.create(
        bill_type='other',
        supplier=supplier,
        status='draft',
        issue_date=date.today(),
        due_date=case.invoice_due_date or (date.today() + timedelta(days=30)),
        supplier_ref=case.invoice_ref,
        subtotal=case.invoice_amount,
        total_amount=case.invoice_amount,
        notes=f'{label} — {case.asset_name} ({case.asset_ref}). Case ID: {case.id}',
        created_by=request.user,
    )
    case.bill = bill
    case.save(update_fields=['bill'])

    # Log step advance to payment_processed trigger
    ComplianceCaseStep.objects.create(
        case=case,
        step=ComplianceRenewalCase.STEP_INVOICE,
        note=f'Bill {bill.bill_number} created. Supplier: {supplier.company_name}',
        actioned_by=request.user,
    )

    serializer = ComplianceRenewalCaseSerializer(case)
    return Response(serializer.data)


def _update_asset_cert(case):
    """Update Asset certificate fields when a renewal is completed."""
    if not case.asset_ref:
        return
    try:
        from inventory.models import Asset
        FIELD_MAP = {
            'insurance':      ('insurance_expiry', None),
            'inspection':     ('inspection_cert_expiry', 'inspection_cert_number'),
            'speed_governor': ('speed_governor_cert_expiry', 'speed_governor_cert_number'),
        }
        fields = FIELD_MAP.get(case.compliance_type)
        if not fields:
            return
        expiry_field, cert_field = fields
        asset = Asset.objects.filter(asset_code=case.asset_ref).first()
        if not asset:
            return
        update_fields = []
        if case.new_expiry:
            setattr(asset, expiry_field, case.new_expiry)
            update_fields.append(expiry_field)
        if cert_field and case.new_cert_number:
            setattr(asset, cert_field, case.new_cert_number)
            update_fields.append(cert_field)
        if update_fields:
            asset.save(update_fields=update_fields)
    except Exception:
        pass
