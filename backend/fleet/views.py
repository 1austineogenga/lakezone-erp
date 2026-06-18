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

        # Idle hours today: sum duration_minutes for trips that are still open (no ended_at)
        # and approximate from VehicleLiveData status counts as a fallback.
        # More accurately: count VehicleLiveData snapshots with IDLE status today * sync_interval.
        from .models import VehicleLiveData
        idle_snapshots_today = VehicleLiveData.objects.filter(
            fetched_at__gte=today_start,
            status__iexact='IDLE',
        ).count()
        # Each snapshot represents ~90s of real time
        idle_hours_today = round((idle_snapshots_today * 90) / 3600, 2)

        # Fuel fills and drains today
        fuel_agg_today = FuelEvent.objects.filter(occurred_at__gte=today_start).aggregate(
            filled=Sum('fuel_change', filter=Q(event_type=FuelEvent.EventType.FILL)),
            drained=Sum('fuel_change', filter=Q(event_type__in=[FuelEvent.EventType.DRAIN, FuelEvent.EventType.THEFT])),
        )
        fuel_filled_today = float(fuel_agg_today['filled'] or 0)
        fuel_drained_today = abs(float(fuel_agg_today['drained'] or 0))

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
            'idle_hours_today': idle_hours_today,
            'fuel_filled_today': fuel_filled_today,
            'fuel_drained_today': fuel_drained_today,
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


class FetchHistoryView(APIView):
    """Fetch trip history from TrackNTrace API for a date range."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        date_from = request.data.get('date_from')
        date_to = request.data.get('date_to')
        if not date_from or not date_to:
            return Response({'detail': 'date_from and date_to are required (YYYY-MM-DD).'}, status=400)
        try:
            service = FleetSyncService()
            result = service.fetch_history(date_from, date_to)
            return Response(result)
        except Exception as e:
            logger.exception("fetch_history failed")
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FetchFuelEventsView(APIView):
    """Fetch pre-processed fuel fill/drain events from Trakzee API (values in litres)."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        date_from = request.data.get('date_from')
        date_to = request.data.get('date_to')
        if not date_from or not date_to:
            return Response({'detail': 'date_from and date_to are required (YYYY-MM-DD).'}, status=400)
        try:
            service = FleetSyncService()
            result = service.fetch_fuel_events_from_api(date_from, date_to)
            return Response(result)
        except Exception as e:
            logger.exception("fetch_fuel_events failed")
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class BackfillView(APIView):
    """Re-process all existing VehicleLiveData snapshots to generate trips and fuel events."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            service = FleetSyncService()
            result = service.backfill_from_snapshots()
            return Response(result)
        except Exception as e:
            logger.exception("Backfill failed")
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FetchVehicleDetailsView(APIView):
    """Probe getVehicleDetail endpoint for vehicle info (tank capacity, etc.)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        vehicle_no = request.query_params.get('vehicle_no', '')
        try:
            service = FleetSyncService()
            result = service.fetch_vehicle_details(vehicle_no=vehicle_no or None)
            return Response(result)
        except Exception as e:
            logger.exception("fetch_vehicle_details failed")
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class FleetDebugView(APIView):
    """Raw API debug — returns token + raw vehicle data from Trakzee."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import requests as req
        config = FleetAPIConfig.objects.filter(is_active=True).first()
        if not config:
            return Response({'error': 'No active fleet config found.'}, status=400)

        result = {
            'config': {
                'base_url': config.base_url,
                'username': config.username,
                'company_name': config.company_name,
                'project_id': config.project_id,
                'api_type': config.api_type,
            },
            'step1_token': None,
            'step1_raw': None,
            'step1_error': None,
            'step2_raw': None,
            'step2_error': None,
        }

        # Step 1: get token — use cached if available (same logic as sync service)
        from django.utils import timezone as tz
        from datetime import timedelta
        token = ''
        now = tz.now()
        if (config.cached_token and config.token_fetched_at and
                (now - config.token_fetched_at) < timedelta(minutes=50)):
            token = config.cached_token
            result['step1_token'] = token[:40] + '…' if len(token) > 40 else token
            result['step1_source'] = 'cached'
            result['token_age_minutes'] = round((now - config.token_fetched_at).total_seconds() / 60, 1)
        else:
            try:
                url1 = f"{config.base_url}/webservice?token=generateAccessToken"
                r1 = req.post(url1, json={'username': config.username, 'password': config.password}, timeout=15)
                result['step1_status'] = r1.status_code
                try:
                    result['step1_raw'] = r1.json()
                    data1 = r1.json()
                except Exception:
                    result['step1_raw'] = r1.text[:500]
                    data1 = {}
                inner = data1.get('data', data1)
                token = (inner.get('token') or inner.get('auth-code') or inner.get('access_token')
                         or inner.get('auth_code') or inner.get('authCode') or '')
                if not token and isinstance(data1, dict):
                    token = next((v for v in data1.values() if isinstance(v, str) and len(v) > 10), '')
                result['step1_token'] = token[:40] + '…' if len(token) > 40 else token
                result['step1_source'] = 'fresh'
            except Exception as e:
                result['step1_error'] = str(e)
                return Response(result)

        if not token:
            result['step1_error'] = 'Could not obtain token — check credentials or wait for cached token to refresh'
            return Response(result)

        # Step 2b: probe vehicle detail/calibration endpoints
        calibration_endpoints = [
            'getVehicleDetails', 'getVehicleInfo', 'getVehicleCalibration',
            'getFuelCalibration', 'getVehicleConfiguration', 'getVehicleList',
            # Newly discovered endpoints
            'getVehicleCurrentLocation', 'getVehicleTrackLogs',
            'getVehicleLiveInformation', 'getVehicleDetail',
        ]
        # Pick a sample vehicle_no to pass in the payload
        from .models import Vehicle as _Vehicle
        _sample_vehicle = _Vehicle.objects.filter(is_active=True).first()
        _sample_vno = _sample_vehicle.vehicle_no if _sample_vehicle else ''

        result['calibration_probe'] = {}
        for ep in calibration_endpoints:
            try:
                url_ep = f"{config.base_url}/webservice?token={ep}&ProjectId={config.project_id}"
                r_ep = req.post(url_ep, json={
                    'company_names': config.company_name,
                    'vehicle_nos': _sample_vno,
                    'format': 'json',
                }, headers={'auth-code': token}, timeout=8)
                try:
                    result['calibration_probe'][ep] = {'status': r_ep.status_code, 'body': r_ep.json()}
                except Exception:
                    result['calibration_probe'][ep] = {'status': r_ep.status_code, 'body': r_ep.text[:300]}
            except Exception as e:
                result['calibration_probe'][ep] = {'error': str(e)}

        # Step 2: fetch vehicle data
        try:
            url2 = f"{config.base_url}/webservice?token=getTokenBaseLiveData&ProjectId={config.project_id}"
            headers = {'auth-code': token}
            payload = {
                'company_names': config.company_name,
                'vehicle_nos': '',
                'imei_nos': '',
                'format': 'json',
            }
            r2 = req.post(url2, json=payload, headers=headers, timeout=15)
            result['step2_status'] = r2.status_code
            try:
                raw = r2.json()
                result['step2_raw'] = raw
                # Extract vehicle list for easy inspection
                vehicles_data = []
                if isinstance(raw, dict):
                    root = raw.get('root', raw)
                    vehicles_data = root.get('VehicleData', root.get('Data', root.get('data', []))) if isinstance(root, dict) else []
                elif isinstance(raw, list):
                    vehicles_data = raw
                if isinstance(vehicles_data, dict):
                    vehicles_data = [vehicles_data]
                result['vehicle_count'] = len(vehicles_data) if isinstance(vehicles_data, list) else 0
                result['vehicle_nos'] = [
                    str(v.get('Vehicle_No', v.get('vehicle_no', v.get('VehicleNo', '?'))))
                    for v in (vehicles_data if isinstance(vehicles_data, list) else [])
                ]
                # Show all field keys from first vehicle so we can see exact fuel field name
                if vehicles_data and isinstance(vehicles_data, list) and len(vehicles_data) > 0:
                    result['sample_vehicle_fields'] = list(vehicles_data[0].keys())
                    result['sample_vehicle_fuel_fields'] = {
                        k: v for k, v in vehicles_data[0].items()
                        if 'fuel' in str(k).lower() or 'Fuel' in str(k)
                    }
            except Exception:
                result['step2_raw'] = r2.text[:1000]
                result['vehicle_count'] = 0
                result['vehicle_nos'] = []
        except Exception as e:
            result['step2_error'] = str(e)

        return Response(result)
