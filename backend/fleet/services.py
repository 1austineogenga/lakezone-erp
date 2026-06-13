import logging
import requests
from datetime import datetime, timedelta
from django.utils import timezone
from django.db import transaction

logger = logging.getLogger(__name__)


class FleetSyncService:
    SYNC_INTERVAL_SECONDS = 90
    FUEL_FILL_THRESHOLD = 5.0
    FUEL_DRAIN_THRESHOLD = 5.0
    THEFT_THRESHOLD = 10.0
    SPEED_ALERT_THRESHOLD = 100

    def sync_all(self):
        from .models import FleetAPIConfig
        configs = FleetAPIConfig.objects.filter(is_active=True)
        results = []
        for config in configs:
            try:
                result = self.sync_config(config)
                results.append({'config_id': config.id, 'success': True, 'synced': result})
            except Exception as e:
                logger.error(f"sync_config failed for config {config.id}: {e}")
                results.append({'config_id': config.id, 'success': False, 'error': str(e)})
        return results

    def sync_config(self, config):
        from .models import Vehicle
        vehicles = Vehicle.objects.filter(api_config=config, is_active=True)

        synced_count = 0
        if config.api_type == 'token_based':
            vehicle_list = list(vehicles)
            try:
                # Pass empty lists to fetch ALL vehicles from the API when none registered yet
                raw_data_list = self._fetch_token_based(config, vehicle_list)
                for raw in raw_data_list:
                    vehicle_no = raw.get('Vehicle_No', '').strip()
                    if not vehicle_no:
                        continue
                    # Auto-create vehicle record if not yet in DB
                    try:
                        vehicle = next(v for v in vehicle_list if v.vehicle_no == vehicle_no)
                    except StopIteration:
                        vehicle, created = Vehicle.objects.get_or_create(
                            vehicle_no=vehicle_no,
                            defaults={
                                'vehicle_name': raw.get('Vehicle_Name', vehicle_no),
                                'imei': raw.get('IMEI', ''),
                                'vehicle_type': raw.get('Vehicletype', ''),
                                'api_config': config,
                                'is_active': True,
                            }
                        )
                        if created:
                            vehicle_list.append(vehicle)
                    try:
                        data = self._parse_vehicle_data(raw)
                        self._process_vehicle(vehicle, data)
                        synced_count += 1
                    except Exception as e:
                        logger.error(f"Error processing vehicle {vehicle_no}: {e}")
            except Exception as e:
                logger.error(f"Token-based fetch failed: {e}")
        else:
            for vehicle in vehicles:
                try:
                    raw = self._fetch_vehicle_wise(config, vehicle)
                    data = self._parse_vehicle_data(raw)
                    self._process_vehicle(vehicle, data)
                    synced_count += 1
                except Exception as e:
                    logger.error(f"Vehicle-wise fetch failed for {vehicle.vehicle_no}: {e}")

        config.last_sync_at = timezone.now()
        config.save(update_fields=['last_sync_at'])
        self._cleanup_old_live_data()
        return synced_count

    def _get_token(self, config):
        now = timezone.now()
        token_valid_duration = timedelta(minutes=50)

        if (config.cached_token and config.token_fetched_at and
                (now - config.token_fetched_at) < token_valid_duration):
            return config.cached_token

        url = f"{config.base_url}/webservice?token=generateAccessToken"
        payload = {'username': config.username, 'password': config.password}
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        resp = response.json()
        # TrackNTrace returns {"result":1,"data":{"token":"..."}}
        data = resp.get('data', resp)
        token = (data.get('token') or data.get('auth-code') or data.get('access_token')
                 or data.get('auth_code') or data.get('authCode') or '')

        config.cached_token = token
        config.token_fetched_at = now
        config.save(update_fields=['cached_token', 'token_fetched_at'])
        return token

    def _fetch_token_based(self, config, vehicles):
        token = self._get_token(config)
        # Empty strings → API returns all vehicles under the company
        vehicle_nos = ','.join(v.vehicle_no for v in vehicles) if vehicles else ''
        imei_nos = ','.join(v.imei for v in vehicles if v.imei) if vehicles else ''

        url = f"{config.base_url}/webservice?token=getTokenBaseLiveData&ProjectId={config.project_id}"
        headers = {'auth-code': token}
        payload = {
            'company_names': config.company_name,
            'vehicle_nos': vehicle_nos,
            'imei_nos': imei_nos,
            'format': 'json',
        }
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        response.raise_for_status()
        data = response.json()
        return data.get('root', {}).get('VehicleData', [])

    def _fetch_vehicle_wise(self, config, vehicle):
        url = (
            f"{config.base_url}/webservice"
            f"?token=getLiveData"
            f"&user={config.username}"
            f"&pass={config.password}"
            f"&vehicle_no={vehicle.vehicle_no}"
            f"&format=json"
        )
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        vehicle_data = data.get('root', {}).get('VehicleData', [])
        if vehicle_data:
            return vehicle_data[0]
        return {}

    def _parse_vehicle_data(self, raw):
        def clean(val):
            if val is None or str(val).strip() in ('--', '-', '', 'N/A'):
                return None
            return val

        def parse_bool(val):
            if val is None:
                return False
            return str(val).strip().upper() == 'ON'

        def parse_float(val):
            v = clean(val)
            if v is None:
                return None
            try:
                return float(v)
            except (ValueError, TypeError):
                return None

        def parse_int(val):
            v = clean(val)
            if v is None:
                return None
            try:
                return int(float(str(v).replace(',', '')))
            except (ValueError, TypeError):
                return None

        def parse_datetime(val):
            v = clean(val)
            if v is None:
                return None
            for fmt in ('%d-%m-%Y %H:%M:%S', '%Y-%m-%d %H:%M:%S', '%d/%m/%Y %H:%M:%S'):
                try:
                    dt = datetime.strptime(str(v).strip(), fmt)
                    return timezone.make_aware(dt) if timezone.is_naive(dt) else dt
                except ValueError:
                    continue
            return None

        def parse_fuel(val):
            if val is None:
                return None
            if isinstance(val, list):
                if not val:
                    return None
                try:
                    return float(val[0])
                except (ValueError, TypeError):
                    return None
            return parse_float(val)

        driver_parts = [
            raw.get('Driver_First_Name', '') or '',
            raw.get('Driver_Middle_Name', '') or '',
            raw.get('Driver_Last_Name', '') or '',
        ]
        driver_name = ' '.join(p.strip() for p in driver_parts if p.strip())

        return {
            'vehicle_no': clean(raw.get('Vehicle_No')) or '',
            'vehicle_name': clean(raw.get('Vehicle_Name')) or '',
            'company': clean(raw.get('Company')) or '',
            'vehicle_type': clean(raw.get('Vehicletype')) or '',
            'latitude': parse_float(raw.get('Latitude')),
            'longitude': parse_float(raw.get('Longitude')),
            'location_name': clean(raw.get('Location')) or '',
            'angle': parse_int(raw.get('Angle')) or 0,
            'status': clean(raw.get('Status')) or '',
            'speed': parse_float(raw.get('Speed')) or 0.0,
            'gps_on': parse_bool(raw.get('GPS')),
            'ignition_on': parse_bool(raw.get('IGN')),
            'power_on': parse_bool(raw.get('Power')),
            'immobilize_state': clean(raw.get('Immobilize_State')) or '',
            'fuel_level': parse_fuel(raw.get('Fuel')),
            'battery_percentage': parse_int(raw.get('battery_percentage')),
            'external_volt': parse_float(raw.get('ExternalVolt')),
            'temperature': parse_float(raw.get('Temperature')),
            'odometer': parse_int(raw.get('Odometer')) or 0,
            'sos': parse_bool(raw.get('SOS')),
            'driver_name': driver_name,
            'device_datetime': parse_datetime(raw.get('Datetime')),
            'gps_actual_time': parse_datetime(raw.get('GPSActualTime')),
            'device_model': clean(raw.get('DeviceModel')) or '',
            'poi': clean(raw.get('POI')) or '',
        }

    def _process_vehicle(self, vehicle, data):
        from .models import VehicleLiveData
        prev_reading = vehicle.live_data.order_by('-fetched_at').first()

        with transaction.atomic():
            snapshot = VehicleLiveData.objects.create(
                vehicle=vehicle,
                device_datetime=data.get('device_datetime'),
                gps_actual_time=data.get('gps_actual_time'),
                latitude=data.get('latitude'),
                longitude=data.get('longitude'),
                location_name=data.get('location_name', ''),
                angle=data.get('angle', 0),
                status=data.get('status', ''),
                speed=data.get('speed', 0),
                gps_on=data.get('gps_on', False),
                ignition_on=data.get('ignition_on', False),
                power_on=data.get('power_on', False),
                immobilize_state=data.get('immobilize_state', ''),
                fuel_level=data.get('fuel_level'),
                battery_percentage=data.get('battery_percentage'),
                external_volt=data.get('external_volt'),
                temperature=data.get('temperature'),
                odometer=data.get('odometer', 0),
                sos=data.get('sos', False),
                driver_name=data.get('driver_name', ''),
            )
            self._update_vehicle_cache(vehicle, data)
            if prev_reading:
                self._detect_fuel_events(vehicle, prev_reading, data)
                self._detect_trip(vehicle, prev_reading, data)
            self._check_alerts(vehicle, data)

        return snapshot

    def _detect_fuel_events(self, vehicle, prev_reading, new_data):
        from .models import FuelEvent
        prev_fuel = float(prev_reading.fuel_level) if prev_reading.fuel_level is not None else None
        new_fuel = new_data.get('fuel_level')

        if prev_fuel is None or new_fuel is None:
            return

        fuel_change = new_fuel - prev_fuel

        if fuel_change >= self.FUEL_FILL_THRESHOLD:
            FuelEvent.objects.create(
                vehicle=vehicle,
                event_type=FuelEvent.EventType.FILL,
                occurred_at=new_data.get('device_datetime') or timezone.now(),
                location_name=new_data.get('location_name', ''),
                latitude=new_data.get('latitude'),
                longitude=new_data.get('longitude'),
                fuel_before=prev_fuel,
                fuel_after=new_fuel,
                fuel_change=fuel_change,
            )
        elif fuel_change <= -self.FUEL_DRAIN_THRESHOLD and not new_data.get('ignition_on'):
            event_type = FuelEvent.EventType.THEFT if abs(fuel_change) >= self.THEFT_THRESHOLD else FuelEvent.EventType.DRAIN
            FuelEvent.objects.create(
                vehicle=vehicle,
                event_type=event_type,
                occurred_at=new_data.get('device_datetime') or timezone.now(),
                location_name=new_data.get('location_name', ''),
                latitude=new_data.get('latitude'),
                longitude=new_data.get('longitude'),
                fuel_before=prev_fuel,
                fuel_after=new_fuel,
                fuel_change=fuel_change,
            )

    def _detect_trip(self, vehicle, prev_reading, new_data):
        from .models import TripRecord
        prev_ignition = prev_reading.ignition_on
        new_ignition = new_data.get('ignition_on', False)
        now = new_data.get('device_datetime') or timezone.now()

        if not prev_ignition and new_ignition:
            # Trip start
            TripRecord.objects.create(
                vehicle=vehicle,
                started_at=now,
                start_location=new_data.get('location_name', ''),
                start_latitude=new_data.get('latitude'),
                start_longitude=new_data.get('longitude'),
                start_odometer=new_data.get('odometer', 0),
                driver_name=new_data.get('driver_name', ''),
            )
        elif prev_ignition and not new_ignition:
            # Trip end - close most recent open trip
            open_trip = TripRecord.objects.filter(vehicle=vehicle, ended_at__isnull=True).order_by('-started_at').first()
            if open_trip:
                start_odo = open_trip.start_odometer
                end_odo = new_data.get('odometer', 0)
                distance_m = max(0, end_odo - start_odo)
                distance_km = round(distance_m / 1000, 2)
                duration_minutes = int((now - open_trip.started_at).total_seconds() / 60) if now > open_trip.started_at else 0

                open_trip.ended_at = now
                open_trip.end_location = new_data.get('location_name', '')
                open_trip.end_latitude = new_data.get('latitude')
                open_trip.end_longitude = new_data.get('longitude')
                open_trip.end_odometer = end_odo
                open_trip.distance_km = distance_km
                open_trip.duration_minutes = duration_minutes
                open_trip.save()

    def _check_alerts(self, vehicle, data):
        from .models import FleetAlert
        now = data.get('device_datetime') or timezone.now()

        # SOS
        if data.get('sos'):
            self._create_alert_if_not_recent(
                vehicle=vehicle,
                alert_type=FleetAlert.AlertType.SOS,
                severity=FleetAlert.Severity.CRITICAL,
                message=f"SOS emergency triggered by {vehicle.vehicle_no}",
                data=data,
                occurred_at=now,
            )

        # Speeding
        speed = data.get('speed', 0) or 0
        if float(speed) > self.SPEED_ALERT_THRESHOLD:
            self._create_alert_if_not_recent(
                vehicle=vehicle,
                alert_type=FleetAlert.AlertType.SPEEDING,
                severity=FleetAlert.Severity.HIGH,
                message=f"{vehicle.vehicle_no} is overspeeding at {speed} km/h",
                data=data,
                occurred_at=now,
            )

        # Low fuel
        fuel = data.get('fuel_level')
        if fuel is not None and float(fuel) < 10:
            self._create_alert_if_not_recent(
                vehicle=vehicle,
                alert_type=FleetAlert.AlertType.LOW_FUEL,
                severity=FleetAlert.Severity.MEDIUM,
                message=f"{vehicle.vehicle_no} has low fuel: {fuel} L",
                data=data,
                occurred_at=now,
            )

        # Moving without ignition
        speed_val = float(data.get('speed', 0) or 0)
        if speed_val > 5 and not data.get('ignition_on'):
            self._create_alert_if_not_recent(
                vehicle=vehicle,
                alert_type=FleetAlert.AlertType.IGNITION_OFF_MOVING,
                severity=FleetAlert.Severity.HIGH,
                message=f"{vehicle.vehicle_no} is moving ({speed_val} km/h) without ignition",
                data=data,
                occurred_at=now,
            )

    def _create_alert_if_not_recent(self, vehicle, alert_type, severity, message, data, occurred_at):
        from .models import FleetAlert
        recent_window = timezone.now() - timedelta(minutes=15)
        exists = FleetAlert.objects.filter(
            vehicle=vehicle,
            alert_type=alert_type,
            acknowledged=False,
            occurred_at__gte=recent_window,
        ).exists()
        if not exists:
            FleetAlert.objects.create(
                vehicle=vehicle,
                alert_type=alert_type,
                severity=severity,
                message=message,
                latitude=data.get('latitude'),
                longitude=data.get('longitude'),
                occurred_at=occurred_at,
            )

    def _update_vehicle_cache(self, vehicle, data):
        vehicle.last_status = data.get('status', '')
        vehicle.last_location = data.get('location_name', '')
        lat = data.get('latitude')
        lon = data.get('longitude')
        vehicle.last_latitude = lat
        vehicle.last_longitude = lon
        vehicle.last_speed = data.get('speed', 0) or 0
        vehicle.last_fuel = data.get('fuel_level')
        vehicle.last_odometer = data.get('odometer', 0) or 0
        vehicle.last_seen = data.get('device_datetime') or timezone.now()
        vehicle.save(update_fields=[
            'last_status', 'last_location', 'last_latitude', 'last_longitude',
            'last_speed', 'last_fuel', 'last_odometer', 'last_seen', 'updated_at',
        ])

    def backfill_from_snapshots(self):
        """Process existing VehicleLiveData history to generate missing trips and fuel events."""
        from .models import Vehicle, VehicleLiveData, TripRecord, FuelEvent
        vehicles = Vehicle.objects.filter(is_active=True)
        trips_created = 0
        fuel_events_created = 0

        for vehicle in vehicles:
            snapshots = list(
                VehicleLiveData.objects.filter(vehicle=vehicle).order_by('fetched_at')
            )
            if len(snapshots) < 2:
                continue

            # Clear existing auto-detected trips and fuel events so backfill is idempotent
            TripRecord.objects.filter(vehicle=vehicle).delete()
            FuelEvent.objects.filter(vehicle=vehicle).delete()

            open_trip = None
            prev = snapshots[0]
            for snap in snapshots[1:]:
                new_data = {
                    'ignition_on': snap.ignition_on,
                    'fuel_level': float(snap.fuel_level) if snap.fuel_level is not None else None,
                    'location_name': snap.location_name or '',
                    'latitude': float(snap.latitude) if snap.latitude is not None else None,
                    'longitude': float(snap.longitude) if snap.longitude is not None else None,
                    'odometer': snap.odometer or 0,
                    'speed': float(snap.speed) if snap.speed is not None else 0,
                    'driver_name': snap.driver_name or '',
                    'device_datetime': snap.device_datetime or snap.fetched_at,
                }
                prev_data = {
                    'ignition_on': prev.ignition_on,
                    'fuel_level': float(prev.fuel_level) if prev.fuel_level is not None else None,
                }

                # Fuel detection
                pf = prev_data['fuel_level']
                nf = new_data['fuel_level']
                if pf is not None and nf is not None:
                    change = nf - pf
                    if change >= self.FUEL_FILL_THRESHOLD:
                        FuelEvent.objects.create(
                            vehicle=vehicle,
                            event_type=FuelEvent.EventType.FILL,
                            occurred_at=new_data['device_datetime'],
                            location_name=new_data['location_name'],
                            latitude=new_data['latitude'],
                            longitude=new_data['longitude'],
                            fuel_before=pf,
                            fuel_after=nf,
                            fuel_change=change,
                        )
                        fuel_events_created += 1
                    elif change <= -self.FUEL_DRAIN_THRESHOLD and not new_data['ignition_on']:
                        etype = FuelEvent.EventType.THEFT if abs(change) >= self.THEFT_THRESHOLD else FuelEvent.EventType.DRAIN
                        FuelEvent.objects.create(
                            vehicle=vehicle,
                            event_type=etype,
                            occurred_at=new_data['device_datetime'],
                            location_name=new_data['location_name'],
                            latitude=new_data['latitude'],
                            longitude=new_data['longitude'],
                            fuel_before=pf,
                            fuel_after=nf,
                            fuel_change=change,
                        )
                        fuel_events_created += 1

                # Trip detection
                pi = prev_data['ignition_on']
                ni = new_data['ignition_on']
                now = new_data['device_datetime']
                if not pi and ni:
                    open_trip = TripRecord.objects.create(
                        vehicle=vehicle,
                        started_at=now,
                        start_location=new_data['location_name'],
                        start_latitude=new_data['latitude'],
                        start_longitude=new_data['longitude'],
                        start_odometer=new_data['odometer'],
                        driver_name=new_data['driver_name'],
                    )
                    trips_created += 1
                elif pi and not ni and open_trip:
                    end_odo = new_data['odometer']
                    dist_km = round(max(0, end_odo - open_trip.start_odometer) / 1000, 2)
                    dur_min = int((now - open_trip.started_at).total_seconds() / 60) if now > open_trip.started_at else 0
                    open_trip.ended_at = now
                    open_trip.end_location = new_data['location_name']
                    open_trip.end_latitude = new_data['latitude']
                    open_trip.end_longitude = new_data['longitude']
                    open_trip.end_odometer = end_odo
                    open_trip.distance_km = dist_km
                    open_trip.duration_minutes = dur_min
                    open_trip.save()
                    open_trip = None

                prev = snap

        return {
            'trips_created': trips_created,
            'fuel_events_created': fuel_events_created,
            'vehicles_processed': vehicles.count(),
        }

    def _cleanup_old_live_data(self):
        from .models import VehicleLiveData
        cutoff = timezone.now() - timedelta(days=30)
        deleted_count, _ = VehicleLiveData.objects.filter(fetched_at__lt=cutoff).delete()
        if deleted_count:
            logger.info(f"Cleaned up {deleted_count} old VehicleLiveData records")
