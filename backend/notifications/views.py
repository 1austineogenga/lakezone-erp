from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Notification, ScheduledAction, ActionComment
from .serializers import NotificationSerializer, ScheduledActionSerializer, ActionCommentSerializer


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
