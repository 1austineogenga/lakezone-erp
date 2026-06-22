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
            if isinstance(val, bool):
                return val
            s = str(val).strip().upper()
            return s in ('ON', 'TRUE', '1', 'YES')

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
            """Returns (normalized_value, unit) where unit is 'L' or '%'."""
            if val is None:
                return None, '%'
            if isinstance(val, list):
                if not val:
                    return None, '%'
                entry = val[0]
                if isinstance(entry, dict):
                    raw_val = entry.get('value')
                    port = str(entry.get('port_name', '')).lower()
                    try:
                        fval = float(raw_val) if raw_val is not None else None
                    except (ValueError, TypeError):
                        return None, '%'
                    if fval is None:
                        return None, '%'
                    if 'liter' in port or 'litre' in port or 'ltr' in port:
                        # Actual litres sensor
                        return round(fval, 1), 'L'
                    else:
                        # BLE / FUEL TANK ADC sensor (0-4095) → normalize to 0–100%
                        pct = round(min(fval / 4095.0 * 100, 100.0), 1)
                        return pct, '%'
                try:
                    return float(entry), '%'
                except (ValueError, TypeError):
                    return None, '%'
            fval = parse_float(val)
            return fval, '%'

        driver_parts = [
            raw.get('Driver_First_Name', '') or '',
            raw.get('Driver_Middle_Name', '') or '',
            raw.get('Driver_Last_Name', '') or '',
        ]
        driver_name = ' '.join(p.strip() for p in driver_parts if p.strip())

        vehicle_status = clean(raw.get('Status')) or ''
        ign_raw = raw.get('IGN')
        # Fall back to status-based ignition when IGN field is absent or unhelpful
        if ign_raw is None or str(ign_raw).strip() in ('', '--', '-', 'N/A'):
            ignition_on = vehicle_status.upper() in ('MOVING', 'IDLE', 'ON')
        else:
            ignition_on = parse_bool(ign_raw)

        return {
            'vehicle_no': clean(raw.get('Vehicle_No')) or '',
            'vehicle_name': clean(raw.get('Vehicle_Name')) or '',
            'company': clean(raw.get('Company')) or '',
            'vehicle_type': clean(raw.get('Vehicletype')) or '',
            'latitude': parse_float(raw.get('Latitude')),
            'longitude': parse_float(raw.get('Longitude')),
            'location_name': clean(raw.get('Location')) or '',
            'angle': parse_int(raw.get('Angle')) or 0,
            'status': vehicle_status,
            'speed': parse_float(raw.get('Speed')) or 0.0,
            'gps_on': parse_bool(raw.get('GPS')),
            'ignition_on': ignition_on,
            'power_on': parse_bool(raw.get('Power')),
            'immobilize_state': clean(raw.get('Immobilize_State')) or '',
            **dict(zip(('fuel_level', 'fuel_sensor_unit'), parse_fuel(raw.get('Fuel')))),
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

        # Convert ADC-based % to litres for vehicles with known tank capacity
        fuel_level = data.get('fuel_level')
        fuel_unit = data.get('fuel_sensor_unit', '%')
        if (
            fuel_level is not None
            and fuel_unit == '%'
            and vehicle.fuel_capacity
            and float(vehicle.fuel_capacity) > 0
        ):
            data['fuel_level'] = round(float(fuel_level) / 100 * float(vehicle.fuel_capacity), 1)
            data['fuel_sensor_unit'] = 'L'

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
        from .models import FuelEvent, FleetAlert
        prev_fuel = float(prev_reading.fuel_level) if prev_reading.fuel_level is not None else None
        new_fuel = new_data.get('fuel_level')

        if prev_fuel is None or new_fuel is None:
            return

        fuel_change = new_fuel - prev_fuel
        occurred_at = new_data.get('device_datetime') or timezone.now()
        unit = vehicle.fuel_sensor_unit or '%'

        if fuel_change >= self.FUEL_FILL_THRESHOLD:
            FuelEvent.objects.create(
                vehicle=vehicle,
                event_type=FuelEvent.EventType.FILL,
                occurred_at=occurred_at,
                location_name=new_data.get('location_name', ''),
                latitude=new_data.get('latitude'),
                longitude=new_data.get('longitude'),
                fuel_before=prev_fuel,
                fuel_after=new_fuel,
                fuel_change=fuel_change,
            )
            FleetAlert.objects.create(
                vehicle=vehicle,
                alert_type=FleetAlert.AlertType.FUEL_FILL,
                severity=FleetAlert.Severity.LOW,
                message=f"Fuel refill detected: +{fuel_change:.1f}{unit} ({prev_fuel:.1f} → {new_fuel:.1f}{unit})",
                latitude=new_data.get('latitude'),
                longitude=new_data.get('longitude'),
                occurred_at=occurred_at,
            )
        elif fuel_change <= -self.FUEL_DRAIN_THRESHOLD and not new_data.get('ignition_on'):
            event_type = FuelEvent.EventType.THEFT if abs(fuel_change) >= self.THEFT_THRESHOLD else FuelEvent.EventType.DRAIN
            FuelEvent.objects.create(
                vehicle=vehicle,
                event_type=event_type,
                occurred_at=occurred_at,
                location_name=new_data.get('location_name', ''),
                latitude=new_data.get('latitude'),
                longitude=new_data.get('longitude'),
                fuel_before=prev_fuel,
                fuel_after=new_fuel,
                fuel_change=fuel_change,
            )
            is_theft = abs(fuel_change) >= self.THEFT_THRESHOLD
            FleetAlert.objects.create(
                vehicle=vehicle,
                alert_type=FleetAlert.AlertType.FUEL_DRAIN,
                severity=FleetAlert.Severity.CRITICAL if is_theft else FleetAlert.Severity.HIGH,
                message=f"{'Possible fuel theft' if is_theft else 'Fuel drain'} detected: {fuel_change:.1f}{unit} ({prev_fuel:.1f} → {new_fuel:.1f}{unit})",
                latitude=new_data.get('latitude'),
                longitude=new_data.get('longitude'),
                occurred_at=occurred_at,
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
        from .models import FleetAlert, VehicleLiveData
        now = data.get('device_datetime') or timezone.now()

        # Long idle — only fire if vehicle has been IDLE for >30 minutes
        if data.get('status', '').upper() == 'IDLE':
            idle_threshold_minutes = 30
            idle_start_cutoff = now - timedelta(minutes=idle_threshold_minutes)
            # Find the most recent snapshot that was NOT idle (marks when idle period began)
            first_non_idle = (
                VehicleLiveData.objects.filter(vehicle=vehicle, fetched_at__lte=now)
                .exclude(status__iexact='IDLE')
                .order_by('-fetched_at')
                .first()
            )
            if first_non_idle is not None:
                idle_since = first_non_idle.fetched_at
            else:
                # All known history is idle — use oldest snapshot as idle_since
                oldest = VehicleLiveData.objects.filter(vehicle=vehicle).order_by('fetched_at').first()
                idle_since = oldest.fetched_at if oldest else now

            if idle_since <= idle_start_cutoff:
                idle_minutes = int((now - idle_since).total_seconds() / 60)
                self._create_alert_if_not_recent(
                    vehicle=vehicle,
                    alert_type=FleetAlert.AlertType.IDLE_LONG,
                    severity=FleetAlert.Severity.LOW,
                    message=f"{vehicle.vehicle_no} has been idle for {idle_minutes} minutes",
                    data=data,
                    occurred_at=now,
                )

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
        if data.get('fuel_sensor_unit'):
            vehicle.fuel_sensor_unit = data['fuel_sensor_unit']
        vehicle.last_odometer = data.get('odometer', 0) or 0
        vehicle.last_seen = data.get('device_datetime') or timezone.now()
        vehicle.save(update_fields=[
            'last_status', 'last_location', 'last_latitude', 'last_longitude',
            'last_speed', 'last_fuel', 'fuel_sensor_unit', 'last_odometer', 'last_seen', 'updated_at',
        ])

    def fetch_history(self, date_from, date_to):
        """Fetch trip history from the TrackNTrace API for the given date range."""
        from .models import FleetAPIConfig, Vehicle, TripRecord
        config = FleetAPIConfig.objects.filter(is_active=True).first()
        if not config:
            return {'error': 'No active fleet config'}

        token = self._get_token(config)
        vehicles = list(Vehicle.objects.filter(is_active=True, api_config=config))
        vehicle_nos = ','.join(v.vehicle_no for v in vehicles)

        headers = {'auth-code': token}

        # Convert YYYY-MM-DD to DD-MM-YYYY (TrackNTrace uses DD-MM-YYYY)
        def reformat(d):
            try:
                from datetime import datetime
                return datetime.strptime(d, '%Y-%m-%d').strftime('%d-%m-%Y')
            except Exception:
                return d

        date_from_fmt = reformat(date_from)
        date_to_fmt   = reformat(date_to)

        # Try multiple payload shapes — we don't know exact param names
        payload_variants = [
            {'company_names': config.company_name, 'vehicle_nos': vehicle_nos, 'from_date': date_from_fmt, 'to_date': date_to_fmt, 'format': 'json'},
            {'company_names': config.company_name, 'vehicle_nos': vehicle_nos, 'fromdate': date_from_fmt, 'todate': date_to_fmt, 'format': 'json'},
            {'company_names': config.company_name, 'vehicle_nos': vehicle_nos, 'start_date': date_from_fmt, 'end_date': date_to_fmt, 'format': 'json'},
            {'company_names': config.company_name, 'vehicle_nos': vehicle_nos, 'from_date': date_from, 'to_date': date_to, 'format': 'json'},
        ]

        endpoints_to_try = [
            f'getTokenBaseTripData&ProjectId={config.project_id}',
            f'getTripReport&ProjectId={config.project_id}',
            f'getTokenBaseHistoryData&ProjectId={config.project_id}',
            f'getHistoryData&ProjectId={config.project_id}',
        ]

        raw_response = None
        used_endpoint = None
        debug_responses = []

        for ep in endpoints_to_try:
            url = f"{config.base_url}/webservice?token={ep}"
            for payload in payload_variants:
                try:
                    resp = requests.post(url, json=payload, headers=headers, timeout=30)
                    if resp.status_code == 200:
                        data = resp.json()
                        debug_responses.append({'endpoint': ep, 'payload_keys': list(payload.keys()), 'response': data})
                        # If response has trip data (not just RESULT/MSG error), use it
                        keys = set(data.keys()) if isinstance(data, dict) else set()
                        if keys - {'RESULT', 'MSG', 'result', 'msg'}:
                            raw_response = data
                            used_endpoint = ep
                            break
                        # Store first 200 response as fallback even if it's RESULT/MSG
                        if raw_response is None:
                            raw_response = data
                            used_endpoint = ep
                except Exception as e:
                    debug_responses.append({'endpoint': ep, 'error': str(e)})
            if raw_response is not None and set(raw_response.keys() if isinstance(raw_response, dict) else []) - {'RESULT', 'MSG', 'result', 'msg'}:
                break

        if raw_response is None:
            return {
                'error': 'None of the history endpoints responded successfully.',
                'tried': endpoints_to_try,
                'debug': debug_responses,
            }

        # If only RESULT/MSG returned, it's an error — report it clearly
        if isinstance(raw_response, dict) and set(raw_response.keys()) <= {'RESULT', 'MSG', 'result', 'msg'}:
            return {
                'endpoint_used': used_endpoint,
                'error': f"API returned error: RESULT={raw_response.get('RESULT', raw_response.get('result'))}, MSG={raw_response.get('MSG', raw_response.get('msg'))}",
                'raw_response': raw_response,
                'debug': debug_responses[:3],
                'trips_in_response': 0,
                'trips_imported': 0,
            }

        # Parse trip records from response
        trips_imported = 0
        trip_list = (
            raw_response.get('root', {}).get('TripData', [])
            or raw_response.get('root', {}).get('VehicleData', [])
            or raw_response.get('TripData', [])
            or (raw_response if isinstance(raw_response, list) else [])
        )

        vehicle_map = {v.vehicle_no: v for v in vehicles}

        for t in trip_list:
            vehicle_no = (t.get('Vehicle_No') or t.get('vehicle_no') or '').strip()
            vehicle = vehicle_map.get(vehicle_no)
            if not vehicle:
                continue

            def _dt(key):
                val = t.get(key)
                if not val:
                    return None
                for fmt in ('%d-%m-%Y %H:%M:%S', '%Y-%m-%d %H:%M:%S', '%d/%m/%Y %H:%M:%S'):
                    try:
                        from datetime import datetime
                        dt = datetime.strptime(str(val).strip(), fmt)
                        return timezone.make_aware(dt) if timezone.is_naive(dt) else dt
                    except ValueError:
                        continue
                return None

            started_at = _dt('Start_Time') or _dt('start_time') or _dt('StartTime')
            ended_at = _dt('End_Time') or _dt('end_time') or _dt('EndTime')
            if not started_at:
                continue

            distance_raw = t.get('Distance') or t.get('distance') or t.get('Distance_km') or 0
            try:
                distance_km = float(str(distance_raw).replace(',', ''))
                # If value looks like metres, convert
                if distance_km > 5000:
                    distance_km = round(distance_km / 1000, 2)
            except (ValueError, TypeError):
                distance_km = 0

            duration_raw = t.get('Duration') or t.get('duration') or t.get('Duration_Minutes') or 0
            try:
                duration_minutes = int(float(str(duration_raw).replace(',', '')))
            except (ValueError, TypeError):
                duration_minutes = 0

            max_speed_raw = t.get('Max_Speed') or t.get('max_speed') or t.get('MaxSpeed') or 0
            try:
                max_speed = float(str(max_speed_raw).replace(',', ''))
            except (ValueError, TypeError):
                max_speed = 0

            TripRecord.objects.get_or_create(
                vehicle=vehicle,
                started_at=started_at,
                defaults={
                    'ended_at': ended_at,
                    'start_location': t.get('Start_Location') or t.get('start_location') or '',
                    'end_location': t.get('End_Location') or t.get('end_location') or '',
                    'distance_km': distance_km,
                    'duration_minutes': duration_minutes,
                    'max_speed': max_speed,
                    'driver_name': t.get('Driver_Name') or t.get('driver_name') or '',
                }
            )
            trips_imported += 1

        return {
            'endpoint_used': used_endpoint,
            'raw_keys': list(raw_response.keys()) if isinstance(raw_response, dict) else 'list',
            'trips_in_response': len(trip_list),
            'trips_imported': trips_imported,
        }

    def fetch_fuel_events_from_api(self, date_from, date_to):
        """Fetch pre-processed fuel fill/drain events from Trakzee API (values in litres)."""
        from .models import FleetAPIConfig, Vehicle, FuelEvent
        config = FleetAPIConfig.objects.filter(is_active=True).first()
        if not config:
            return {'error': 'No active fleet config'}

        token = self._get_token(config)
        vehicles = list(Vehicle.objects.filter(is_active=True, api_config=config))
        vehicle_nos = ','.join(v.vehicle_no for v in vehicles)
        vehicle_map = {v.vehicle_no: v for v in vehicles}
        headers = {'auth-code': token}

        def reformat(d):
            try:
                from datetime import datetime as _dt
                return _dt.strptime(d, '%Y-%m-%d').strftime('%d-%m-%Y')
            except Exception:
                return d

        date_from_fmt = reformat(date_from)
        date_to_fmt   = reformat(date_to)

        fuel_endpoints = [
            f'getFuelFillData&ProjectId={config.project_id}',
            f'getFuelFillEvent&ProjectId={config.project_id}',
            f'getFuelFillHistory&ProjectId={config.project_id}',
            f'getTokenBaseFuelData&ProjectId={config.project_id}',
            f'getFuelEventHistory&ProjectId={config.project_id}',
            f'getTokenBaseFuelFillData&ProjectId={config.project_id}',
            f'getFuelAlert&ProjectId={config.project_id}',
            f'getAlertHistory&ProjectId={config.project_id}',
            # Newly discovered endpoints
            f'getVehicleTrackLogs&ProjectId={config.project_id}',
            f'getVehicleCurrentLocation&ProjectId={config.project_id}',
            f'getVehicleLiveInformation&ProjectId={config.project_id}',
        ]

        payload_variants = [
            {'company_names': config.company_name, 'vehicle_nos': vehicle_nos, 'from_date': date_from_fmt, 'to_date': date_to_fmt, 'format': 'json'},
            {'company_names': config.company_name, 'vehicle_nos': vehicle_nos, 'fromdate': date_from_fmt, 'todate': date_to_fmt, 'format': 'json'},
            {'company_names': config.company_name, 'vehicle_nos': vehicle_nos, 'start_date': date_from_fmt, 'end_date': date_to_fmt, 'format': 'json'},
        ]

        debug_responses = []
        raw_response = None
        used_endpoint = None

        for ep in fuel_endpoints:
            url = f"{config.base_url}/webservice?token={ep}"
            for payload in payload_variants:
                try:
                    resp = requests.post(url, json=payload, headers=headers, timeout=30)
                    if resp.status_code == 200:
                        data = resp.json()
                        debug_responses.append({'endpoint': ep, 'status': 200, 'response': data})
                        keys = set(data.keys()) if isinstance(data, dict) else set()
                        if keys - {'RESULT', 'MSG', 'result', 'msg'}:
                            raw_response = data
                            used_endpoint = ep
                            break
                except Exception as e:
                    debug_responses.append({'endpoint': ep, 'error': str(e)})
            if raw_response:
                break

        if raw_response is None:
            return {
                'error': 'No fuel event endpoint found. See debug_responses for details.',
                'debug_responses': debug_responses,
                'events_imported': 0,
            }

        # Extract list from various response shapes
        event_list = (
            raw_response.get('root', {}).get('FuelData', [])
            or raw_response.get('root', {}).get('FuelFillData', [])
            or raw_response.get('root', {}).get('AlertData', [])
            or raw_response.get('FuelData', [])
            or raw_response.get('FuelFillData', [])
            or raw_response.get('AlertData', [])
            or (raw_response if isinstance(raw_response, list) else [])
        )

        def _dt(val):
            if not val:
                return None
            for fmt in ('%d-%m-%Y %H:%M:%S', '%Y-%m-%d %H:%M:%S', '%d/%m/%Y %H:%M:%S'):
                try:
                    from datetime import datetime as _d
                    dt = _d.strptime(str(val).strip(), fmt)
                    return timezone.make_aware(dt) if timezone.is_naive(dt) else dt
                except ValueError:
                    continue
            return None

        def _float(val):
            try:
                return float(str(val).replace(',', ''))
            except (ValueError, TypeError):
                return None

        events_imported = 0
        for e in event_list:
            vehicle_no = (e.get('Vehicle_No') or e.get('vehicle_no') or '').strip()
            vehicle = vehicle_map.get(vehicle_no)
            if not vehicle:
                continue

            occurred_at = _dt(e.get('Datetime') or e.get('datetime') or e.get('Date_Time') or e.get('AlertTime'))
            if not occurred_at:
                continue

            fuel_before = _float(e.get('Before_Fuel') or e.get('before_fuel') or e.get('FuelBefore') or e.get('Fuel_Before'))
            fuel_after  = _float(e.get('After_Fuel')  or e.get('after_fuel')  or e.get('FuelAfter')  or e.get('Fuel_After'))
            fuel_change = _float(e.get('Fuel_Change')  or e.get('fuel_change') or e.get('FuelChange'))

            if fuel_before is None or fuel_after is None:
                continue
            if fuel_change is None:
                fuel_change = fuel_after - fuel_before

            event_type_raw = str(e.get('Event_Type') or e.get('event_type') or e.get('AlertType') or '').lower()
            if 'fill' in event_type_raw or fuel_change > 0:
                event_type = FuelEvent.EventType.FILL
            elif 'theft' in event_type_raw:
                event_type = FuelEvent.EventType.THEFT
            else:
                event_type = FuelEvent.EventType.DRAIN

            FuelEvent.objects.get_or_create(
                vehicle=vehicle,
                occurred_at=occurred_at,
                defaults={
                    'event_type': event_type,
                    'fuel_before': fuel_before,
                    'fuel_after': fuel_after,
                    'fuel_change': abs(fuel_change) if event_type == FuelEvent.EventType.FILL else -abs(fuel_change),
                    'location_name': e.get('Location') or e.get('location') or '',
                },
            )
            events_imported += 1

        return {
            'endpoint_used': used_endpoint,
            'events_in_response': len(event_list),
            'events_imported': events_imported,
            'debug_responses': debug_responses[:5],
        }

    def fetch_vehicle_details(self, vehicle_no=None):
        """
        Probe the getVehicleDetail endpoint to retrieve vehicle info,
        potentially including tank capacity. Results are returned as-is for debug purposes.
        """
        from .models import FleetAPIConfig, Vehicle
        config = FleetAPIConfig.objects.filter(is_active=True).first()
        if not config:
            return {'error': 'No active fleet config'}

        token = self._get_token(config)
        headers = {'auth-code': token}

        # Use first active vehicle if none specified
        if not vehicle_no:
            first_vehicle = Vehicle.objects.filter(is_active=True, api_config=config).first()
            vehicle_no = first_vehicle.vehicle_no if first_vehicle else ''

        payload = {
            'company_names': config.company_name,
            'vehicle_nos': vehicle_no,
            'format': 'json',
        }

        debug = {}
        for ep in ['getVehicleDetail', 'getVehicleDetails', 'getVehicleInfo']:
            url = f"{config.base_url}/webservice?token={ep}&ProjectId={config.project_id}"
            try:
                resp = requests.post(url, json=payload, headers=headers, timeout=15)
                try:
                    debug[ep] = {'status': resp.status_code, 'body': resp.json()}
                except Exception:
                    debug[ep] = {'status': resp.status_code, 'body': resp.text[:500]}
            except Exception as e:
                debug[ep] = {'error': str(e)}

        return {'vehicle_no_probed': vehicle_no, 'results': debug}

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
                # Use status-based ignition since old snapshots may have IGN parsed as False
                snap_ign = snap.ignition_on or (snap.status.upper() in ('MOVING', 'IDLE', 'ON') if snap.status else False)
                new_data = {
                    'ignition_on': snap_ign,
                    'fuel_level': float(snap.fuel_level) if snap.fuel_level is not None else None,
                    'location_name': snap.location_name or '',
                    'latitude': float(snap.latitude) if snap.latitude is not None else None,
                    'longitude': float(snap.longitude) if snap.longitude is not None else None,
                    'odometer': snap.odometer or 0,
                    'speed': float(snap.speed) if snap.speed is not None else 0,
                    'driver_name': snap.driver_name or '',
                    'device_datetime': snap.device_datetime or snap.fetched_at,
                }
                prev_ign = prev.ignition_on or (prev.status.upper() in ('MOVING', 'IDLE', 'ON') if prev.status else False)
                prev_data = {
                    'ignition_on': prev_ign,
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
