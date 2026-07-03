import logging
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Count, Sum, Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import (
    FleetAPIConfig, Vehicle, VehicleLiveData, FuelEvent,
    TripRecord, FleetAlert, MaintenanceRecord,
    VehicleCompliance, VehicleAssignment, FuelPrice, Geofence, GeofenceEvent,
)
from .serializers import (
    FleetAPIConfigSerializer, VehicleSerializer, VehicleLiveDataSerializer,
    FuelEventSerializer, TripRecordSerializer, FleetAlertSerializer,
    MaintenanceRecordSerializer, FuelPriceSerializer, GeofenceSerializer, GeofenceEventSerializer,
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
        # Low fuel: < 30L or < 15% capacity (compare against absolute 30L for safety)
        low_fuel_count = vehicles.filter(last_fuel__isnull=False, last_fuel__lt=30).count()

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


class VehicleComplianceView(APIView):
    """GET/PATCH compliance items for a vehicle."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        vehicle = get_object_or_404(Vehicle, pk=pk)
        from .serializers import VehicleComplianceSerializer
        data = VehicleComplianceSerializer(vehicle.compliance.all(), many=True).data
        return Response(data)

    def patch(self, request, pk):
        vehicle = get_object_or_404(Vehicle, pk=pk)
        compliance_type = request.data.get('compliance_type')
        if not compliance_type:
            return Response({'error': 'compliance_type required'}, status=400)
        import datetime as dt_mod
        expiry_raw = request.data.get('expiry_date')
        status_override = request.data.get('status')
        expiry_date = None
        if expiry_raw:
            try:
                expiry_date = dt_mod.date.fromisoformat(expiry_raw)
            except Exception:
                pass
        if not status_override and expiry_date:
            today = dt_mod.date.today()
            if expiry_date < today:
                status_override = 'expired'
            elif (expiry_date - today).days <= 30:
                status_override = 'expiring_soon'
            else:
                status_override = 'valid'
        obj, _ = VehicleCompliance.objects.update_or_create(
            vehicle=vehicle, compliance_type=compliance_type,
            defaults={
                'expiry_date': expiry_date,
                'status': status_override or 'unknown',
                'notes': request.data.get('notes', ''),
            }
        )
        from .serializers import VehicleComplianceSerializer
        return Response(VehicleComplianceSerializer(obj).data)


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
                return Response(
                    {"detail": f"Fleet sync failed: {e}"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

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
        alert_types = self.request.query_params.getlist('alert_type')
        if alert_types:
            qs = qs.filter(alert_type__in=alert_types)
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
            total_filled_cost = fills.aggregate(total=Sum('total_cost'))['total'] or 0
            total_drained_cost = abs(drains.aggregate(total=Sum('total_cost'))['total'] or 0)

            report.append({
                'vehicle_no': vehicle.vehicle_no,
                'vehicle_name': vehicle.vehicle_name,
                'total_fills': fills.count(),
                'total_drains': drains.count(),
                'total_fuel_filled': float(total_filled),
                'total_fuel_drained': float(total_drained),
                'total_fuel_filled_cost': float(total_filled_cost),
                'total_fuel_drained_cost': float(total_drained_cost),
                'estimated_consumption': float(total_filled) - float(total_drained),
                'estimated_consumption_cost': float(total_filled_cost) - float(total_drained_cost),
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


class FetchTrackNTraceAlertsView(APIView):
    """Pull alert history from the TrackNTrace/Trakzee API and store as FleetAlerts."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        date_from = request.data.get('date_from')
        date_to = request.data.get('date_to')
        if not date_from or not date_to:
            return Response({'detail': 'date_from and date_to are required (YYYY-MM-DD).'}, status=400)
        try:
            service = FleetSyncService()
            result = service.fetch_trackntrace_alerts(date_from, date_to)
            return Response(result)
        except Exception as e:
            logger.exception("fetch_trackntrace_alerts failed")
            return Response({'detail': str(e)}, status=500)


class CheckMaintenanceDueView(APIView):
    """Run maintenance/service due checks for all active vehicles and generate alerts."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            service = FleetSyncService()
            result = service.check_all_maintenance_due()
            return Response(result)
        except Exception as e:
            logger.exception("check_maintenance_due failed")
            return Response({'detail': str(e)}, status=500)


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


class FleetRegisterImportView(APIView):
    """Import Fleet Master Register from Excel (.xlsx)."""
    permission_classes = [IsAuthenticated]

    COMPLIANCE_MAP = {
        'insurance':      ('insurance',      FleetAlert.AlertType.INSURANCE_EXPIRY),
        'inspection':     ('inspection',     FleetAlert.AlertType.INSPECTION_EXPIRY),
        'speed_governor': ('speed_governor', FleetAlert.AlertType.SPEED_GOV_EXPIRY),
    }

    def _parse_date(self, val):
        """Return (date, status_str) from an openpyxl cell value."""
        import datetime as dt_mod
        if val is None:
            return None, 'unknown'
        if isinstance(val, (dt_mod.date, dt_mod.datetime)):
            return val.date() if isinstance(val, dt_mod.datetime) else val, None
        s = str(val).strip()
        if s in ('', '–', '-', 'None'):
            return None, 'unknown'
        upper = s.upper()
        if upper == 'EXPIRED':
            return None, 'expired'
        if 'NOT IN SYSTEM' in upper:
            return None, 'not_in_system'
        if upper in ('N/A', 'NA'):
            return None, 'not_applicable'
        for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y'):
            try:
                return dt_mod.datetime.strptime(s[:10], fmt).date(), None
            except Exception:
                pass
        return None, 'unknown'

    def _compliance_status(self, expiry_date, override_status):
        import datetime as dt_mod
        if override_status:
            return override_status
        if expiry_date is None:
            return 'unknown'
        today = dt_mod.date.today()
        if expiry_date < today:
            return 'expired'
        if (expiry_date - today).days <= 30:
            return 'expiring_soon'
        return 'valid'

    def _clean(self, val):
        if val is None:
            return ''
        s = str(val).strip()
        return '' if s in ('–', '-', 'None', 'N/A') else s

    def post(self, request):
        import openpyxl
        import datetime as dt_mod

        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided.'}, status=400)

        try:
            wb = openpyxl.load_workbook(file, data_only=True)
            ws = wb['Fleet Master Register']
        except Exception as e:
            return Response({'error': f'Could not read workbook: {e}'}, status=400)

        today = dt_mod.date.today()
        imported = updated = compliance_alerts = 0
        errors = []

        for row in ws.iter_rows(min_row=7, values_only=True):
            # Skip section headers and empty rows
            if not isinstance(row[0], int):
                continue

            (asset_no, asset_category, asset_sub_type, make, model,
             plate, chassis, yr_mfg, yr_acq, site, driver_name,
             op_status, meter, ins_exp, insp_exp, spd_exp,
             defects, req_actions, erp_code, erp_status, priority, notes_txt) = row[:22]

            # Determine vehicle_no
            plate_clean = self._clean(plate)
            if plate_clean and plate_clean.upper() not in ('N/A', ''):
                vehicle_no = plate_clean
            else:
                code = self._clean(erp_code) or 'ASSET'
                vehicle_no = f"{code}-{asset_no}"

            vehicle_name = f"{self._clean(make)} {self._clean(model)}".strip()

            # Map ERP status → operational fields
            erp_s = self._clean(erp_status).upper()
            is_active = erp_s in ('OPER', '')

            defaults = dict(
                vehicle_name=vehicle_name,
                make=self._clean(make),
                model_name=self._clean(model),
                vehicle_type=self._clean(asset_sub_type),
                asset_no=asset_no,
                asset_category=self._clean(asset_category),
                asset_sub_type=self._clean(asset_sub_type),
                chassis_number=self._clean(chassis),
                year_manufacture=int(yr_mfg) if yr_mfg else None,
                year_acquired=int(yr_acq) if yr_acq else None,
                current_site=self._clean(site),
                erp_code=self._clean(erp_code),
                erp_status=erp_s if erp_s in ('OPER', 'NON-OPER', 'IDLE', 'UNKNOWN') else '',
                priority_flag=self._clean(priority).upper() if priority else '',
                known_defects=self._clean(defects),
                required_actions=self._clean(req_actions),
                meter_reading=self._clean(meter),
                notes=self._clean(notes_txt),
                is_active=is_active,
            )

            try:
                vehicle, created_flag = Vehicle.objects.update_or_create(
                    vehicle_no=vehicle_no, defaults=defaults
                )
                if created_flag:
                    imported += 1
                else:
                    updated += 1
            except Exception as e:
                errors.append(f"Row {asset_no}: {e}")
                continue

            # --- Compliance ---
            compliance_data = {
                'insurance':      ins_exp,
                'inspection':     insp_exp,
                'speed_governor': spd_exp,
            }
            for ctype, raw_val in compliance_data.items():
                exp_date, override = self._parse_date(raw_val)
                cstatus = self._compliance_status(exp_date, override)
                VehicleCompliance.objects.update_or_create(
                    vehicle=vehicle, compliance_type=ctype,
                    defaults={'expiry_date': exp_date, 'status': cstatus}
                )
                # Create alert for expired / expiring soon / not_in_system
                if cstatus in ('expired', 'expiring_soon', 'not_in_system'):
                    alert_type_map = {
                        'insurance':      FleetAlert.AlertType.INSURANCE_EXPIRY,
                        'inspection':     FleetAlert.AlertType.INSPECTION_EXPIRY,
                        'speed_governor': FleetAlert.AlertType.SPEED_GOV_EXPIRY,
                    }
                    atype = alert_type_map[ctype]
                    severity = 'critical' if cstatus == 'expired' else 'high'
                    if cstatus == 'not_in_system':
                        severity = 'medium'
                    label = {'insurance': 'Insurance', 'inspection': 'Inspection Certificate',
                             'speed_governor': 'Speed Governor Certificate'}[ctype]
                    if cstatus == 'expired':
                        msg = f"{label} EXPIRED for {vehicle_no}"
                    elif cstatus == 'expiring_soon':
                        days = (exp_date - today).days
                        msg = f"{label} expires in {days} days ({exp_date}) for {vehicle_no}"
                    else:
                        msg = f"{label} NOT IN SYSTEM for {vehicle_no}"

                    # Avoid duplicate unacknowledged alerts
                    exists = FleetAlert.objects.filter(
                        vehicle=vehicle, alert_type=atype, acknowledged=False
                    ).exists()
                    if not exists:
                        FleetAlert.objects.create(
                            vehicle=vehicle, alert_type=atype,
                            severity=severity, message=msg,
                            occurred_at=timezone.now()
                        )
                        compliance_alerts += 1

            # --- Driver Assignment ---
            driver = self._clean(driver_name)
            if driver and driver.lower() not in ('not assigned', 'n/a', ''):
                # Try to match HR employee
                employee = None
                parts = driver.split()
                if len(parts) >= 2:
                    from hr.models import Employee
                    try:
                        employee = Employee.objects.filter(
                            first_name__iexact=parts[0],
                            last_name__iexact=parts[-1],
                            is_active=True
                        ).first()
                    except Exception:
                        pass
                # Deactivate old assignments
                VehicleAssignment.objects.filter(vehicle=vehicle, is_current=True).update(is_current=False)
                VehicleAssignment.objects.update_or_create(
                    vehicle=vehicle, driver_name=driver,
                    defaults={
                        'employee': employee,
                        'site': self._clean(site),
                        'is_current': True,
                    }
                )

            # --- Sync to Assets module ---
            try:
                from inventory.models import Asset
                cat = 'machinery' if 'plant' in self._clean(asset_category).lower() else 'vehicles'
                Asset.objects.update_or_create(
                    asset_code=f"FLT-{asset_no:03d}",
                    defaults=dict(
                        name=vehicle_name or vehicle_no,
                        category=cat,
                        department='Operations',
                        serial_number=self._clean(chassis),
                        make_model=f"{self._clean(make)} {self._clean(model)}".strip(),
                        location=self._clean(site),
                        assigned_to=self._clean(driver_name),
                        condition='good' if erp_s == 'OPER' else ('poor' if erp_s == 'NON-OPER' else 'fair'),
                        status='active' if is_active else 'under_repair',
                        notes=self._clean(defects),
                    )
                )
            except Exception as e:
                logger.warning(f"Asset sync failed for vehicle {vehicle_no}: {e}")

        return Response({
            'imported': imported,
            'updated': updated,
            'compliance_alerts': compliance_alerts,
            'errors': errors,
            'total': imported + updated,
        })


class FuelPriceListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FuelPriceSerializer
    queryset = FuelPrice.objects.all()

    def get_queryset(self):
        qs = super().get_queryset()
        fuel_type = self.request.query_params.get("fuel_type")
        location = self.request.query_params.get("location")
        effective_date_from = self.request.query_params.get("effective_date_from")
        effective_date_to = self.request.query_params.get("effective_date_to")

        if fuel_type:
            qs = qs.filter(fuel_type=fuel_type)
        if location:
            qs = qs.filter(location__iexact=location)
        if effective_date_from:
            qs = qs.filter(effective_date__gte=effective_date_from)
        if effective_date_to:
            qs = qs.filter(effective_date__lte=effective_date_to)
        return qs


class FuelPriceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = FuelPriceSerializer
    queryset = FuelPrice.objects.all()


class CurrentFuelPriceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        location = request.query_params.get("location", "Nairobi")
        current_prices = {}
        for fuel_type, _ in FuelPrice.FUEL_TYPE_CHOICES:
            price = FuelPrice.objects.filter(
                fuel_type=fuel_type, location__iexact=location, effective_date__lte=timezone.now().date()
            ).order_by("-effective_date").first()
            if price:
                current_prices[fuel_type] = FuelPriceSerializer(price).data
        return Response(current_prices)


class SyncAssetsToFleetView(APIView):
    """
    Sync Operations-dept Asset Register → Fleet vehicles without duplication.

    Matching priority (first match wins, no duplicate created):
      1. registration_plate vs vehicle_no  (primary — default)
      2. serial_number      vs vehicle_no
      3. make_model         vs make+model_name  (case-insensitive)
      4. name               vs vehicle_name     (case-insensitive)
      5. asset_code         vs vehicle_no

    GET  → dry-run preview (no DB writes)
    POST → execute sync
    """
    permission_classes = [IsAuthenticated]

    ASSET_TYPE_MAP = {
        'vehicles':      'vehicle',
        'trucks_tracks': 'truck',
        'machinery':     'machine',
    }

    @staticmethod
    def _norm(s):
        return (s or '').upper().replace(' ', '').replace('-', '')

    def _find_vehicle(self, asset, all_vehicles):
        plate  = self._norm(asset.registration_plate)
        serial = self._norm(asset.serial_number)
        code   = self._norm(asset.asset_code)
        name   = (asset.name or '').strip().lower()
        make_model_raw = (asset.make_model or '').strip().lower()

        for v in all_vehicles:
            vno = self._norm(v.vehicle_no)
            # 1. registration plate
            if plate and vno == plate:
                return v, 'registration_plate'
            # 2. serial number
            if serial and vno == serial:
                return v, 'serial_number'

        # 3. make+model match
        if make_model_raw:
            for v in all_vehicles:
                vm = f"{v.make or ''} {v.model_name or ''}".strip().lower()
                if vm and vm == make_model_raw:
                    return v, 'make_model'

        # 4. name match
        if name:
            for v in all_vehicles:
                if (v.vehicle_name or '').strip().lower() == name:
                    return v, 'name'

        # 5. asset_code fallback
        for v in all_vehicles:
            if code and self._norm(v.vehicle_no) == code:
                return v, 'asset_code'

        return None, None

    def _build_plan(self, assets, all_vehicles):
        """Return list of action dicts without touching the DB."""
        CERT_MAP = [
            ('insurance',      'insurance_expiry',           None),
            ('inspection',     'inspection_cert_expiry',     'inspection_cert_status'),
            ('speed_governor', 'speed_governor_cert_expiry', 'speed_governor_cert_status'),
        ]
        plan = []
        for asset in assets:
            vehicle, match_by = self._find_vehicle(asset, all_vehicles)
            mm_parts  = (asset.make_model or '').split(' ', 1)
            make_val  = mm_parts[0] if mm_parts else ''
            model_val = mm_parts[1] if len(mm_parts) > 1 else ''

            plate  = (asset.registration_plate or '').strip()
            serial = (asset.serial_number or '').strip()
            new_no = plate or serial or asset.asset_code

            if vehicle:
                plan.append({
                    'action': 'enrich',
                    'match_by': match_by,
                    'asset_code': asset.asset_code,
                    'asset_name': asset.name,
                    'registration_plate': plate,
                    'vehicle_no': vehicle.vehicle_no,
                    'vehicle_name': vehicle.vehicle_name,
                })
            elif new_no:
                plan.append({
                    'action': 'create',
                    'match_by': None,
                    'asset_code': asset.asset_code,
                    'asset_name': asset.name,
                    'registration_plate': plate,
                    'vehicle_no': new_no,
                    'make': make_val,
                    'model': model_val,
                })
            else:
                plan.append({
                    'action': 'skip',
                    'match_by': None,
                    'asset_code': asset.asset_code,
                    'asset_name': asset.name,
                    'reason': 'No registration plate, serial number, or asset code',
                })
        return plan

    def _sync_compliance(self, vehicle, asset, today):
        CERT_MAP = [
            ('insurance',      'insurance_expiry',           None),
            ('inspection',     'inspection_cert_expiry',     'inspection_cert_status'),
            ('speed_governor', 'speed_governor_cert_expiry', 'speed_governor_cert_status'),
        ]
        for ctype, expiry_field, status_field in CERT_MAP:
            expiry   = getattr(asset, expiry_field, None)
            raw_stat = getattr(asset, status_field, None) if status_field else None
            if not expiry and not raw_stat:
                continue
            if expiry:
                days = (expiry - today).days
                comp_status = 'expired' if days < 0 else ('expiring_soon' if days <= 30 else 'valid')
            else:
                comp_status = {'expired': 'expired', 'not_in_system': 'not_in_system'}.get(raw_stat, 'unknown')
            VehicleCompliance.objects.update_or_create(
                vehicle=vehicle, compliance_type=ctype,
                defaults={'expiry_date': expiry, 'status': comp_status},
            )

    def get(self, request):
        """Dry-run preview — no DB writes."""
        from inventory.models import Asset
        assets      = list(Asset.objects.filter(department='Operations', category__in=self.ASSET_TYPE_MAP.keys()))
        all_vehicles = list(Vehicle.objects.filter(is_active=True))
        plan = self._build_plan(assets, all_vehicles)
        return Response({'plan': plan, 'total': len(plan)})

    def post(self, request):
        from inventory.models import Asset
        import datetime as dt_mod

        today        = dt_mod.date.today()
        assets       = list(Asset.objects.filter(department='Operations', category__in=self.ASSET_TYPE_MAP.keys()))
        all_vehicles = list(Vehicle.objects.filter(is_active=True))
        plan         = self._build_plan(assets, all_vehicles)

        enriched_count = created_count = skipped_count = 0
        errors = []

        asset_map = {a.asset_code: a for a in assets}

        for item in plan:
            asset = asset_map.get(item['asset_code'])
            if not asset:
                continue

            mm_parts  = (asset.make_model or '').split(' ', 1)
            make_val  = mm_parts[0] if mm_parts else ''
            model_val = mm_parts[1] if len(mm_parts) > 1 else ''

            if item['action'] == 'enrich':
                vehicle, _ = self._find_vehicle(asset, all_vehicles)
                if vehicle:
                    changed = False
                    if not vehicle.vehicle_name and asset.name:
                        vehicle.vehicle_name = asset.name; changed = True
                    if not vehicle.make and make_val:
                        vehicle.make = make_val; changed = True
                    if not vehicle.model_name and model_val:
                        vehicle.model_name = model_val; changed = True
                    if not vehicle.vehicle_type:
                        vehicle.vehicle_type = self.ASSET_TYPE_MAP.get(asset.category, ''); changed = True
                    if not vehicle.chassis_number and asset.insurance_chassis_number:
                        vehicle.chassis_number = asset.insurance_chassis_number; changed = True
                    if not vehicle.known_defects and asset.current_defects:
                        vehicle.known_defects = asset.current_defects; changed = True
                    if not vehicle.required_actions and asset.requirements:
                        vehicle.required_actions = asset.requirements; changed = True
                    if changed:
                        vehicle.save()
                    self._sync_compliance(vehicle, asset, today)
                    enriched_count += 1

            elif item['action'] == 'create':
                plate  = (asset.registration_plate or '').strip()
                serial = (asset.serial_number or '').strip()
                new_no = plate or serial or asset.asset_code
                try:
                    vehicle = Vehicle.objects.create(
                        vehicle_no=new_no,
                        vehicle_name=asset.name or '',
                        make=make_val,
                        model_name=model_val,
                        vehicle_type=self.ASSET_TYPE_MAP.get(asset.category, ''),
                        chassis_number=asset.insurance_chassis_number or '',
                        known_defects=asset.current_defects or '',
                        required_actions=asset.requirements or '',
                        is_live=False,
                        source='register',
                        is_active=True,
                    )
                    self._sync_compliance(vehicle, asset, today)
                    created_count += 1
                except Exception as e:
                    errors.append(f"{new_no}: {e}")

            else:
                skipped_count += 1

        return Response({
            'enriched': enriched_count,
            'created':  created_count,
            'skipped':  skipped_count,
            'errors':   errors,
        })


class FetchErcFuelPricesView(APIView):
    """
    Fetch current Kenya ERC pump prices (reviewed on 14th of every month).
    Attempts to scrape the ERC website; always returns current stored prices.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import datetime as dt_mod
        import re
        try:
            import requests as req
        except ImportError:
            return Response({'error': 'requests library not available'}, status=500)

        today = dt_mod.date.today()
        effective_date = today.replace(day=14) if today.day >= 14 else (
            (today.replace(day=1) - dt_mod.timedelta(days=1)).replace(day=14)
        )

        fetched = []
        errors  = []
        html_content = None

        for url in ['https://www.erc.go.ke/pumpprice/', 'https://www.erc.go.ke/petroleum/fuel-prices/']:
            try:
                resp = req.get(url, timeout=15, headers={'User-Agent': 'Mozilla/5.0'})
                if resp.status_code == 200:
                    html_content = resp.text
                    break
            except Exception as e:
                errors.append(str(e))

        if html_content:
            price_map = {}
            for fuel, pattern in [
                ('diesel',   r'[Dd]iesel[^0-9]*?(\d{2,3}(?:\.\d{1,2})?)'),
                ('petrol',   r'(?:[Ss]uper\s+)?[Pp]etrol[^0-9]*?(\d{2,3}(?:\.\d{1,2})?)'),
                ('kerosene', r'[Kk]erosene[^0-9]*?(\d{2,3}(?:\.\d{1,2})?)'),
            ]:
                m = re.search(pattern, html_content)
                if m:
                    price = float(m.group(1))
                    if 100 <= price <= 400:  # sanity: Kenya prices ~150-250 KSh/L
                        price_map[fuel] = price

            for fuel_type, price in price_map.items():
                for location in ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret']:
                    obj, created = FuelPrice.objects.update_or_create(
                        fuel_type=fuel_type, location=location, effective_date=effective_date,
                        defaults={'price_per_litre': price},
                    )
                    fetched.append({'fuel_type': fuel_type, 'price': price, 'location': location, 'created': created})

        # Current prices from DB regardless of scrape success
        current_prices = {}
        for fuel_type, _ in FuelPrice.FUEL_TYPE_CHOICES:
            price = FuelPrice.objects.filter(
                fuel_type=fuel_type, effective_date__lte=today
            ).order_by('-effective_date').first()
            if price:
                current_prices[fuel_type] = {
                    'price_per_litre': str(price.price_per_litre),
                    'effective_date':  str(price.effective_date),
                    'location':        price.location,
                }

        # Next review: 14th of next month
        nm = effective_date.replace(month=effective_date.month % 12 + 1) if effective_date.month < 12 \
             else effective_date.replace(year=effective_date.year + 1, month=1, day=14)

        return Response({
            'scraped_from_erc': len(fetched) > 0,
            'fetched':          fetched,
            'errors':           errors,
            'current_prices':   current_prices,
            'effective_date':   str(effective_date),
            'next_review':      str(nm),
            'note': 'Kenya ERC reviews fuel prices on the 14th of every month.',
        })


class GeofenceListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = GeofenceSerializer
    queryset = Geofence.objects.all()


class GeofenceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = GeofenceSerializer
    queryset = Geofence.objects.all()


class GeofenceEventListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = GeofenceEventSerializer

    def get_queryset(self):
        qs = GeofenceEvent.objects.select_related("vehicle", "geofence")
        vehicle_id = self.request.query_params.get("vehicle")
        geofence_id = self.request.query_params.get("geofence")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")

        if vehicle_id:
            qs = qs.filter(vehicle__id=vehicle_id)
        if geofence_id:
            qs = qs.filter(geofence__id=geofence_id)
        if date_from:
            qs = qs.filter(occurred_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(occurred_at__date__lte=date_to)
        return qs
