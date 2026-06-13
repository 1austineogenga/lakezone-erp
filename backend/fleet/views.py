import logging
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Count, Sum, Q
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import (
    FleetAPIConfig, Vehicle, VehicleLiveData, FuelEvent,
    TripRecord, FleetAlert, MaintenanceRecord,
)
from .serializers import (
    FleetAPIConfigSerializer, VehicleSerializer, VehicleLiveDataSerializer,
    FuelEventSerializer, TripRecordSerializer, FleetAlertSerializer,
    MaintenanceRecordSerializer,
)
from .services import FleetSyncService

logger = logging.getLogger(__name__)


class FleetDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        vehicles = Vehicle.objects.filter(is_active=True)
        total = vehicles.count()

        status_summary = {}
        for s in ['MOVING', 'IDLE', 'STOP', 'INACTIVE']:
            status_summary[s] = vehicles.filter(last_status=s).count()

        # Online = last_seen within last 10 minutes
        online_cutoff = timezone.now() - timedelta(minutes=10)
        online_count = vehicles.filter(last_seen__gte=online_cutoff).count()

        active_trips = TripRecord.objects.filter(ended_at__isnull=True).count()
        unacknowledged_alerts = FleetAlert.objects.filter(acknowledged=False).count()
        low_fuel_count = vehicles.filter(last_fuel__lt=10, last_fuel__isnull=False).count()

        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        total_distance_today = TripRecord.objects.filter(
            started_at__gte=today_start
        ).aggregate(total=Sum('distance_km'))['total'] or 0

        recent_alerts = FleetAlert.objects.select_related('vehicle').order_by('-occurred_at')[:5]
        recent_alerts_data = FleetAlertSerializer(recent_alerts, many=True).data

        vehicles_by_project = (
            vehicles.exclude(project__isnull=True)
            .values('project__name')
            .annotate(count=Count('id'))
            .order_by('-count')
        )

        last_sync = None
        config = FleetAPIConfig.objects.filter(is_active=True).order_by('-last_sync_at').first()
        if config and config.last_sync_at:
            last_sync = config.last_sync_at.isoformat()

        return Response({
            'total_vehicles': total,
            'status_summary': status_summary,
            'online_count': online_count,
            'active_trips': active_trips,
            'unacknowledged_alerts': unacknowledged_alerts,
            'low_fuel_count': low_fuel_count,
            'total_distance_today_km': float(total_distance_today),
            'recent_alerts': recent_alerts_data,
            'vehicles_by_project': [
                {'project_name': item['project__name'], 'count': item['count']}
                for item in vehicles_by_project
            ],
            'last_sync': last_sync,
        })


class VehicleListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = VehicleSerializer

    def get_queryset(self):
        qs = Vehicle.objects.all()
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        project = self.request.query_params.get('project')
        if project:
            qs = qs.filter(project=project)
        return qs


class VehicleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = VehicleSerializer
    queryset = Vehicle.objects.all()


class FleetLiveView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stale_cutoff = timezone.now() - timedelta(seconds=90)
        stale_exists = Vehicle.objects.filter(
            is_active=True
        ).filter(
            Q(last_seen__isnull=True) | Q(last_seen__lt=stale_cutoff)
        ).exists()

        if stale_exists:
            service = FleetSyncService()
            try:
                service.sync_all()
            except Exception as e:
                logger.error(f"Auto-sync failed: {e}")

        vehicles = Vehicle.objects.filter(is_active=True).prefetch_related('live_data')
        data = VehicleSerializer(vehicles, many=True).data
        return Response(data)


class VehicleLiveView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, vehicle_pk):
        try:
            vehicle = Vehicle.objects.get(pk=vehicle_pk)
        except Vehicle.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        live_data = vehicle.live_data.order_by('-fetched_at')[:50]
        return Response(VehicleLiveDataSerializer(live_data, many=True).data)


class ForceSyncView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        service = FleetSyncService()
        try:
            results = service.sync_all()
            vehicles = Vehicle.objects.filter(is_active=True)
            data = VehicleSerializer(vehicles, many=True).data
            return Response({'sync_results': results, 'vehicles': data})
        except Exception as e:
            logger.error(f"Force sync failed: {e}")
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FuelEventListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FuelEventSerializer

    def get_queryset(self):
        qs = FuelEvent.objects.select_related('vehicle')
        vehicle = self.request.query_params.get('vehicle')
        if vehicle:
            qs = qs.filter(vehicle=vehicle)
        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(occurred_at__date__gte=date_from)
        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(occurred_at__date__lte=date_to)
        return qs


class TripListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = TripRecordSerializer

    def get_queryset(self):
        qs = TripRecord.objects.select_related('vehicle')
        vehicle = self.request.query_params.get('vehicle')
        if vehicle:
            qs = qs.filter(vehicle=vehicle)
        date_from = self.request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(started_at__date__gte=date_from)
        date_to = self.request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(started_at__date__lte=date_to)
        return qs


class AlertListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FleetAlertSerializer

    def get_queryset(self):
        qs = FleetAlert.objects.select_related('vehicle', 'acknowledged_by')
        vehicle = self.request.query_params.get('vehicle')
        if vehicle:
            qs = qs.filter(vehicle=vehicle)
        acknowledged = self.request.query_params.get('acknowledged')
        if acknowledged is not None:
            qs = qs.filter(acknowledged=acknowledged.lower() == 'true')
        return qs


class AcknowledgeAlertView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            alert = FleetAlert.objects.get(pk=pk)
        except FleetAlert.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)

        alert.acknowledged = True
        alert.acknowledged_by = request.user
        alert.acknowledged_at = timezone.now()
        alert.save(update_fields=['acknowledged', 'acknowledged_by', 'acknowledged_at'])
        return Response(FleetAlertSerializer(alert).data)


class MaintenanceListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MaintenanceRecordSerializer

    def get_queryset(self):
        qs = MaintenanceRecord.objects.select_related('vehicle', 'created_by')
        vehicle = self.request.query_params.get('vehicle')
        if vehicle:
            qs = qs.filter(vehicle=vehicle)
        return qs


class MaintenanceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MaintenanceRecordSerializer
    queryset = MaintenanceRecord.objects.all()


class FuelReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        vehicle_id = request.query_params.get('vehicle')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        vehicles_qs = Vehicle.objects.filter(is_active=True)
        if vehicle_id:
            vehicles_qs = vehicles_qs.filter(pk=vehicle_id)

        report = []
        for vehicle in vehicles_qs:
            events_qs = FuelEvent.objects.filter(vehicle=vehicle)
            if date_from:
                events_qs = events_qs.filter(occurred_at__date__gte=date_from)
            if date_to:
                events_qs = events_qs.filter(occurred_at__date__lte=date_to)

            fills = events_qs.filter(event_type=FuelEvent.EventType.FILL)
            drains = events_qs.filter(event_type__in=[FuelEvent.EventType.DRAIN, FuelEvent.EventType.THEFT])

            total_filled = fills.aggregate(total=Sum('fuel_change'))['total'] or 0
            total_drained = abs(drains.aggregate(total=Sum('fuel_change'))['total'] or 0)

            report.append({
                'vehicle_no': vehicle.vehicle_no,
                'vehicle_name': vehicle.vehicle_name,
                'total_fills': fills.count(),
                'total_drains': drains.count(),
                'total_fuel_filled': float(total_filled),
                'total_fuel_drained': float(total_drained),
                'estimated_consumption': float(total_filled) - float(total_drained),
                'fill_events': FuelEventSerializer(fills, many=True).data,
            })

        return Response(report)


class UtilizationReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        vehicle_id = request.query_params.get('vehicle')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        vehicles_qs = Vehicle.objects.filter(is_active=True)
        if vehicle_id:
            vehicles_qs = vehicles_qs.filter(pk=vehicle_id)

        report = []
        for vehicle in vehicles_qs:
            trips_qs = TripRecord.objects.filter(vehicle=vehicle, ended_at__isnull=False)
            if date_from:
                trips_qs = trips_qs.filter(started_at__date__gte=date_from)
            if date_to:
                trips_qs = trips_qs.filter(started_at__date__lte=date_to)

            agg = trips_qs.aggregate(
                total_trips=Count('id'),
                total_distance=Sum('distance_km'),
                total_minutes=Sum('duration_minutes'),
            )
            total_runtime_hours = round((agg['total_minutes'] or 0) / 60, 2)

            report.append({
                'vehicle_no': vehicle.vehicle_no,
                'vehicle_name': vehicle.vehicle_name,
                'total_trips': agg['total_trips'] or 0,
                'total_distance_km': float(agg['total_distance'] or 0),
                'total_runtime_hours': total_runtime_hours,
                'last_status': vehicle.last_status,
                'last_seen': vehicle.last_seen.isoformat() if vehicle.last_seen else None,
            })

        return Response(report)


class FleetConfigView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FleetAPIConfigSerializer
    queryset = FleetAPIConfig.objects.all()


class FleetConfigDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FleetAPIConfigSerializer
    queryset = FleetAPIConfig.objects.all()
