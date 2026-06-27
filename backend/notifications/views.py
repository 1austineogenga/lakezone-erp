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


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_read(request, pk):
    try:
        n = Notification.objects.get(pk=pk, recipient=request.user)
        n.is_read = True
        n.save(update_fields=["is_read"])
        return Response({"status": "ok"})
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

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def compliance_alerts(request):
    """Return all vehicle compliance records with expiry info for the Alerts page."""
    from fleet.models import VehicleCompliance
    from fleet.serializers import VehicleComplianceSerializer
    from datetime import date, timedelta

    today = date.today()
    warn_date = today + timedelta(days=30)

    records = VehicleCompliance.objects.select_related('vehicle').filter(
        expiry_date__isnull=False
    ).exclude(status='not_applicable').order_by('expiry_date')

    result = []
    for rec in records:
        days_left = (rec.expiry_date - today).days
        if days_left < 0:
            alert_level = 'expired'
        elif days_left <= 7:
            alert_level = 'critical'
        elif days_left <= 30:
            alert_level = 'warning'
        else:
            alert_level = 'ok'

        result.append({
            'id':             str(rec.id),
            'vehicle_no':     rec.vehicle.vehicle_no,
            'vehicle_name':   rec.vehicle.vehicle_name or rec.vehicle.vehicle_no,
            'compliance_type': rec.compliance_type,
            'expiry_date':    str(rec.expiry_date),
            'days_left':      days_left,
            'alert_level':    alert_level,
            'notes':          rec.notes,
        })

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
