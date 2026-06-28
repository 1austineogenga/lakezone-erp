import logging
import requests
from datetime import datetime, timedelta
import datetime as dt_module
from django.utils import timezone
from django.db import transaction

logger = logging.getLogger(__name__)


class FleetSyncService:
    SYNC_INTERVAL_SECONDS = 90
    FUEL_FILL_THRESHOLD_L = 5.0       # litres
    FUEL_DRAIN_THRESHOLD_L = 5.0      # litres
    THEFT_THRESHOLD_L = 15.0          # litres — large sudden drop = possible theft
    SPEED_ALERT_THRESHOLD = 100       # km/h
    LOW_FUEL_PCT = 0.15               # 15% of capacity
    LOW_FUEL_MIN_L = 30.0             # minimum absolute threshold in litres
    SERVICE_DUE_KM_WARNING = 500      # km before service: warning
    SERVICE_DUE_KM_CRITICAL = 200     # km before service: critical
    SERVICE_DUE_DAYS_WARNING = 14     # days before service date: warning
    ALERT_COOLDOWN_MINUTES = 15       # general alert dedup window
    MAINTENANCE_ALERT_COOLDOWN_HOURS = 6  # dedup window for maintenance alerts

    # ─────────────────────────────────────────────
    # Public entry points
    # ─────────────────────────────────────────────

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
        vehicle_list = list(Vehicle.objects.filter(api_config=config, is_active=True))

        synced_count = 0
        if config.api_type == 'token_based':
            try:
                raw_data_list = self._fetch_token_based(config, vehicle_list)
                for raw in raw_data_list:
                    vehicle_no = raw.get('Vehicle_No', '').strip()
                    if not vehicle_no:
                        continue
                    vehicle = self._resolve_vehicle(vehicle_no, raw, config, vehicle_list)
                    if vehicle not in vehicle_list:
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
            vehicles = Vehicle.objects.filter(api_config=config, is_active=True)
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

    def _resolve_vehicle(self, vehicle_no, raw, config, vehicle_list):
        """Find or create a Vehicle record for the given plate, linking it to config."""
        from .models import Vehicle
        vehicle = next((v for v in vehicle_list if v.vehicle_no == vehicle_no), None)
        if vehicle is None:
            try:
                vehicle = Vehicle.objects.get(vehicle_no__iexact=vehicle_no)
            except Vehicle.DoesNotExist:
                vehicle = None
            except Vehicle.MultipleObjectsReturned:
                vehicle = Vehicle.objects.filter(
                    vehicle_no__iexact=vehicle_no
                ).order_by('-updated_at').first()

        if vehicle is None:
            vehicle = Vehicle.objects.create(
                vehicle_no=vehicle_no,
                vehicle_name=raw.get('Vehicle_Name', '') or vehicle_no,
                imei=raw.get('IMEI', '') or '',
                vehicle_type=raw.get('Vehicletype', '') or '',
                api_config=config,
                is_active=True,
            )
        else:
            update_fields = []
            if vehicle.api_config_id != config.id:
                vehicle.api_config = config
                update_fields.append('api_config')
            if not vehicle.imei and raw.get('IMEI'):
                vehicle.imei = raw['IMEI'].strip()
                update_fields.append('imei')
            if not vehicle.vehicle_name and raw.get('Vehicle_Name'):
                vehicle.vehicle_name = raw['Vehicle_Name'].strip()
                update_fields.append('vehicle_name')
            if not vehicle.vehicle_type and raw.get('Vehicletype'):
                vehicle.vehicle_type = raw['Vehicletype'].strip()
                update_fields.append('vehicle_type')
            if update_fields:
                update_fields.append('updated_at')
                vehicle.save(update_fields=update_fields)
        return vehicle

    # ─────────────────────────────────────────────
    # API fetching
    # ─────────────────────────────────────────────

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
        data = resp.get('data', resp)
        token = (data.get('token') or data.get('auth-code') or data.get('access_token')
                 or data.get('auth_code') or data.get('authCode') or '')

        config.cached_token = token
        config.token_fetched_at = now
        config.save(update_fields=['cached_token', 'token_fetched_at'])
        return token

    def _fetch_token_based(self, config, vehicles):
        token = self._get_token(config)
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
        return vehicle_data[0] if vehicle_data else {}

    # ─────────────────────────────────────────────
    # Data parsing
    # ─────────────────────────────────────────────

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
            return str(val).strip().upper() in ('ON', 'TRUE', '1', 'YES')

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
            """
            Returns (litres_or_pct, unit) where unit is 'L' or '%'.
            - list with port_name containing 'liter/litre/ltr' → actual litres sensor
            - list with other port_name → ADC 0-4095, normalize to 0-100%
            - plain float → treat as percentage
            """
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
                    if 'liter' in port or 'litre' in port or 'ltr' in port or 'fuel_l' in port:
                        # Actual litre sensor
                        return round(fval, 1), 'L'
                    else:
                        # ADC sensor (0-4095) → percentage
                        if fval > 100:
                            pct = round(min(fval / 4095.0 * 100, 100.0), 1)
                        else:
                            pct = round(min(fval, 100.0), 1)
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
        if ign_raw is None or str(ign_raw).strip() in ('', '--', '-', 'N/A'):
            ignition_on = vehicle_status.upper() in ('MOVING', 'IDLE', 'ON')
        else:
            ignition_on = parse_bool(ign_raw)

        fuel_level, fuel_unit = parse_fuel(raw.get('Fuel'))

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
            'fuel_level': fuel_level,
            'fuel_sensor_unit': fuel_unit,
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

    # ─────────────────────────────────────────────
    # Processing
    # ─────────────────────────────────────────────

    def _process_vehicle(self, vehicle, data):
        from .models import VehicleLiveData

        fuel_level = data.get('fuel_level')
        fuel_unit = data.get('fuel_sensor_unit', '%')

        # Convert % → litres using vehicle tank capacity
        if (fuel_level is not None and fuel_unit == '%'
                and vehicle.fuel_capacity and float(vehicle.fuel_capacity) > 0):
            fuel_level = round(float(fuel_level) / 100.0 * float(vehicle.fuel_capacity), 1)
            fuel_unit = 'L'

        data['fuel_level'] = fuel_level
        data['fuel_sensor_unit'] = fuel_unit

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
                fuel_level=fuel_level,
                fuel_unit=fuel_unit,
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
                self._detect_geofence_events(vehicle, prev_reading, data)
            self._check_alerts(vehicle, data)
            self._check_maintenance_due(vehicle, data)

        return snapshot

    def _get_fuel_price_for_event(self, fuel_type, occurred_at, location=None):
        from .models import FuelPrice
        # Try to find a price for the specific location first
        if location:
            price = FuelPrice.objects.filter(
                fuel_type=fuel_type, 
                location__iexact=location, 
                effective_date__lte=occurred_at.date()
            ).order_by("-effective_date").first()
            if price: 
                return price.price_per_litre
        
        # Fallback to Nairobi if no specific location price or location is None
        price = FuelPrice.objects.filter(
            fuel_type=fuel_type, 
            location__iexact="Nairobi", 
            effective_date__lte=occurred_at.date()
        ).order_by("-effective_date").first()
        if price:
            return price.price_per_litre
        
        # Fallback to any location if Nairobi not found
        price = FuelPrice.objects.filter(
            fuel_type=fuel_type, 
            effective_date__lte=occurred_at.date()
        ).order_by("-effective_date").first()
        if price:
            return price.price_per_litre
            
        return None

    def _to_litres(self, fuel_val, fuel_unit, vehicle):
        """Normalize a fuel reading to litres. Returns (litres, ok) where ok=False if can't convert."""
        if fuel_val is None:
            return None, False
        fval = float(fuel_val)
        if fuel_unit == 'L':
            return fval, True
        # fuel_unit is '%'
        if vehicle.fuel_capacity and float(vehicle.fuel_capacity) > 0:
            return round(fval / 100.0 * float(vehicle.fuel_capacity), 1), True
        # Can't convert %, no capacity known — keep raw value but mark as unreliable
        return fval, False

    def _detect_fuel_events(self, vehicle, prev_reading, new_data):
        from .models import FuelEvent, FleetAlert

        new_fuel_raw = new_data.get('fuel_level')
        new_unit = new_data.get('fuel_sensor_unit', 'L')
        prev_fuel_raw = prev_reading.fuel_level
        prev_unit = getattr(prev_reading, 'fuel_unit', None) or vehicle.fuel_sensor_unit or '%'

        if prev_fuel_raw is None or new_fuel_raw is None:
            return

        # Convert both to litres for consistent comparison
        prev_fuel_l, prev_ok = self._to_litres(prev_fuel_raw, prev_unit, vehicle)
        new_fuel_l, new_ok = self._to_litres(new_fuel_raw, new_unit, vehicle)

        if not prev_ok or not new_ok or prev_fuel_l is None or new_fuel_l is None:
            return

        fuel_change = new_fuel_l - prev_fuel_l
        occurred_at = new_data.get('device_datetime') or timezone.now()
        cooldown = timezone.now() - timedelta(minutes=30)

        if fuel_change >= self.FUEL_FILL_THRESHOLD_L:
            if FuelEvent.objects.filter(
                vehicle=vehicle,
                event_type=FuelEvent.EventType.FILL,
                occurred_at__gte=cooldown,
            ).exists():
                return
            price_per_litre = self._get_fuel_price_for_event(
                vehicle.fuel_type, occurred_at, new_data.get('location_name')
            )
            total_cost = round(fuel_change * price_per_litre, 2) if price_per_litre else None

            FuelEvent.objects.create(
                vehicle=vehicle,
                event_type=FuelEvent.EventType.FILL,
                occurred_at=occurred_at,
                location_name=new_data.get('location_name', ''),
                latitude=new_data.get('latitude'),
                longitude=new_data.get('longitude'),
                fuel_before=round(prev_fuel_l, 1),
                fuel_after=round(new_fuel_l, 1),
                fuel_change=round(fuel_change, 1),
                fuel_unit='L',
                price_per_litre=price_per_litre,
                total_cost=total_cost,
            )
            FleetAlert.objects.create(
                vehicle=vehicle,
                alert_type=FleetAlert.AlertType.FUEL_FILL,
                severity=FleetAlert.Severity.LOW,
                message=(
                    f"Fuel refill on {vehicle.vehicle_no}: "
                    f"+{fuel_change:.1f} L  "
                    f"({prev_fuel_l:.1f} L → {new_fuel_l:.1f} L)"
                ),
                latitude=new_data.get('latitude'),
                longitude=new_data.get('longitude'),
                occurred_at=occurred_at,
            )

        elif fuel_change <= -self.FUEL_DRAIN_THRESHOLD_L:
            # Drain detection: ignition off = suspicious drain/theft
            # Ignition on = normal consumption (don't flag unless very large)
            abs_change = abs(fuel_change)
            ignition_on = new_data.get('ignition_on', False)
            # Only flag drains when ignition is off, OR theft threshold exceeded regardless
            if ignition_on and abs_change < self.THEFT_THRESHOLD_L:
                return

            if FuelEvent.objects.filter(
                vehicle=vehicle,
                event_type__in=[FuelEvent.EventType.DRAIN, FuelEvent.EventType.THEFT],
                occurred_at__gte=cooldown,
            ).exists():
                return

            is_theft = abs_change >= self.THEFT_THRESHOLD_L
            event_type = FuelEvent.EventType.THEFT if is_theft else FuelEvent.EventType.DRAIN
            price_per_litre = self._get_fuel_price_for_event(
                vehicle.fuel_type, occurred_at, new_data.get('location_name')
            )
            total_cost = round(abs(fuel_change) * price_per_litre, 2) if price_per_litre else None

            FuelEvent.objects.create(
                vehicle=vehicle,
                event_type=event_type,
                occurred_at=occurred_at,
                location_name=new_data.get('location_name', ''),
                latitude=new_data.get('latitude'),
                longitude=new_data.get('longitude'),
                fuel_before=round(prev_fuel_l, 1),
                fuel_after=round(new_fuel_l, 1),
                fuel_change=round(fuel_change, 1),
                fuel_unit='L',
                price_per_litre=price_per_litre,
                total_cost=total_cost,
            )
            FleetAlert.objects.create(
                vehicle=vehicle,
                alert_type=FleetAlert.AlertType.FUEL_DRAIN,
                severity=FleetAlert.Severity.CRITICAL if is_theft else FleetAlert.Severity.HIGH,
                message=(
                    f"{'Possible fuel theft' if is_theft else 'Fuel drain'} on {vehicle.vehicle_no}: "
                    f"{fuel_change:.1f} L  "
                    f"({prev_fuel_l:.1f} L → {new_fuel_l:.1f} L)"
                ),
                latitude=new_data.get('latitude'),
                longitude=new_data.get('longitude'),
                occurred_at=occurred_at,
            )
            is_theft = abs(fuel_change) >= self.THEFT_THRESHOLD
            FleetAlert.objects.create(
                vehicle=vehicle,
                alert_type=FleetAlert.AlertType.FUEL_DRAIN,
                severity=FleetAlert.Severity.CRITICAL if is_theft else FleetAlert.Severity.HIGH,
                message=f"{vehicle.vehicle_no} {'fuel theft' if is_theft else 'fuel drain'} detected: -{round(abs(fuel_change), 1)} L (from {round(prev_fuel, 1)} to {round(new_fuel, 1)} L)",
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

        # Long idle
        if data.get('status', '').upper() == 'IDLE':
            idle_threshold_minutes = 30
            idle_start_cutoff = now - timedelta(minutes=idle_threshold_minutes)
            first_non_idle = (
                VehicleLiveData.objects.filter(vehicle=vehicle, fetched_at__lte=now)
                .exclude(status__iexact='IDLE')
                .order_by('-fetched_at')
                .first()
            )
            idle_since = first_non_idle.fetched_at if first_non_idle else (
                VehicleLiveData.objects.filter(vehicle=vehicle).order_by('fetched_at').first()
            )
            if isinstance(idle_since, type(None)):
                idle_since = now
            if hasattr(idle_since, 'fetched_at'):
                idle_since = idle_since.fetched_at

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
        speed = float(data.get('speed', 0) or 0)
        if speed > self.SPEED_ALERT_THRESHOLD:
            self._create_alert_if_not_recent(
                vehicle=vehicle,
                alert_type=FleetAlert.AlertType.SPEEDING,
                severity=FleetAlert.Severity.HIGH,
                message=f"{vehicle.vehicle_no} overspeeding at {speed:.0f} km/h",
                data=data,
                occurred_at=now,
            )

        # Low fuel — always in litres at this point (converted in _process_vehicle)
        fuel = data.get('fuel_level')
        fuel_unit = data.get('fuel_sensor_unit', 'L')
        if fuel is not None:
            fuel_val = float(fuel)
            capacity = float(vehicle.fuel_capacity) if vehicle.fuel_capacity else 0
            if fuel_unit == 'L' and capacity > 0:
                low_threshold = max(capacity * self.LOW_FUEL_PCT, self.LOW_FUEL_MIN_L)
                pct = round(fuel_val / capacity * 100, 1)
                if fuel_val < low_threshold:
                    self._create_alert_if_not_recent(
                        vehicle=vehicle,
                        alert_type=FleetAlert.AlertType.LOW_FUEL,
                        severity=FleetAlert.Severity.HIGH if pct < 10 else FleetAlert.Severity.MEDIUM,
                        message=f"{vehicle.vehicle_no} low fuel: {fuel_val:.1f} L ({pct}% of {capacity:.0f} L tank)",
                        data=data,
                        occurred_at=now,
                    )
            elif fuel_unit == 'L':
                # No capacity known — use absolute threshold
                if fuel_val < self.LOW_FUEL_MIN_L:
                    self._create_alert_if_not_recent(
                        vehicle=vehicle,
                        alert_type=FleetAlert.AlertType.LOW_FUEL,
                        severity=FleetAlert.Severity.MEDIUM,
                        message=f"{vehicle.vehicle_no} low fuel: {fuel_val:.1f} L",
                        data=data,
                        occurred_at=now,
                    )
            else:
                # Percentage reading without capacity
                if fuel_val < 15:
                    self._create_alert_if_not_recent(
                        vehicle=vehicle,
                        alert_type=FleetAlert.AlertType.LOW_FUEL,
                        severity=FleetAlert.Severity.MEDIUM,
                        message=f"{vehicle.vehicle_no} low fuel: {fuel_val:.1f}%",
                        data=data,
                        occurred_at=now,
                    )

        # Moving without ignition
        if speed > 5 and not data.get('ignition_on'):
            self._create_alert_if_not_recent(
                vehicle=vehicle,
                alert_type=FleetAlert.AlertType.IGNITION_OFF_MOVING,
                severity=FleetAlert.Severity.HIGH,
                message=f"{vehicle.vehicle_no} is moving ({speed:.0f} km/h) without ignition",
                data=data,
                occurred_at=now,
            )

    def _is_point_in_polygon(self, point, polygon):
        """Determines if a point is inside a polygon using the ray casting algorithm."""
        x, y = point["lng"], point["lat"]
        n = len(polygon)
        inside = False

        p1x, p1y = polygon[0]["lng"], polygon[0]["lat"]
        for i in range(n + 1):
            p2x, p2y = polygon[i % n]["lng"], polygon[i % n]["lat"]
            if y > min(p1y, p2y):
                if y <= max(p1y, p2y):
                    if x <= max(p1x, p2x):
                        if p1y != p2y:
                            xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                        if p1x == p2x or x <= xinters:
                            inside = not inside
            p1x, p1y = p2x, p2y
        return inside

    def _is_point_in_circle(self, point, circle):
        """Determines if a point is inside a circle."""
        from math import radians, sin, cos, sqrt, atan2

        R = 6371  # Radius of Earth in kilometers
        lat1, lon1 = radians(point["lat"]), radians(point["lng"])
        lat2, lon2 = radians(circle["lat"]), radians(circle["lng"])

        dlon = lon2 - lon1
        dlat = lat2 - lat1

        a = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))

        distance = R * c * 1000 # Distance in meters
        return distance <= circle["radius"]

    def _is_point_in_geofence(self, point, geofence):
        """Checks if a given point is within a geofence."""
        if not point or not geofence or not geofence.coordinates:
            return False

        if geofence.geofence_type == "circle":
            return self._is_point_in_circle(point, geofence.coordinates)
        elif geofence.geofence_type == "polygon":
            return self._is_point_in_polygon(point, geofence.coordinates)
        return False

    def _detect_geofence_events(self, vehicle, prev_data, new_data):
        from .models import Geofence, GeofenceEvent, FleetAlert

        new_lat = new_data.get("latitude")
        new_lng = new_data.get("longitude")
        prev_lat = prev_data.latitude if prev_data else None
        prev_lng = prev_data.longitude if prev_data else None

        if new_lat is None or new_lng is None:
            return

        new_point = {"lat": float(new_lat), "lng": float(new_lng)}
        prev_point = {"lat": float(prev_lat), "lng": float(prev_lng)} if prev_lat and prev_lng else None

        active_geofences = Geofence.objects.filter(is_active=True)
        occurred_at = new_data.get("device_datetime") or timezone.now()

        for geofence in active_geofences:
            is_new_in = self._is_point_in_geofence(new_point, geofence)
            is_prev_in = self._is_point_in_geofence(prev_point, geofence) if prev_point else False

            if is_new_in and not is_prev_in: # Entry event
                GeofenceEvent.objects.create(
                    vehicle=vehicle,
                    geofence=geofence,
                    event_type="entry",
                    occurred_at=occurred_at,
                    latitude=new_lat,
                    longitude=new_lng,
                    message=f"{vehicle.vehicle_no} entered geofence {geofence.name}"
                )
                self._create_alert_if_not_recent(
                    vehicle=vehicle,
                    alert_type=FleetAlert.AlertType.GEOFENCE,
                    severity=FleetAlert.Severity.MEDIUM,
                    message=f"{vehicle.vehicle_no} entered geofence {geofence.name}",
                    data=new_data,
                    occurred_at=occurred_at,
                )
            elif not is_new_in and is_prev_in: # Exit event
                GeofenceEvent.objects.create(
                    vehicle=vehicle,
                    geofence=geofence,
                    event_type="exit",
                    occurred_at=occurred_at,
                    latitude=new_lat,
                    longitude=new_lng,
                    message=f"{vehicle.vehicle_no} exited geofence {geofence.name}"
                )
                self._create_alert_if_not_recent(
                    vehicle=vehicle,
                    alert_type=FleetAlert.AlertType.GEOFENCE,
                    severity=FleetAlert.Severity.MEDIUM,
                    message=f"{vehicle.vehicle_no} exited geofence {geofence.name}",
                    data=new_data,
                    occurred_at=occurred_at,
                )

    def _check_maintenance_due(self, vehicle, data):
        """Check if service/maintenance is due based on odometer or date."""
        from .models import FleetAlert, MaintenanceRecord
        import datetime as dt

        now = timezone.now()
        odometer = int(data.get('odometer', 0) or 0)
        odometer_km = odometer / 1000.0

        # Find the most recent maintenance record with a next service due
        last_service = (
            MaintenanceRecord.objects.filter(vehicle=vehicle)
            .exclude(next_service_odometer__isnull=True, next_service_date__isnull=True)
            .order_by('-date')
            .first()
        )
        if not last_service:
            return

        cooldown = now - timedelta(hours=self.MAINTENANCE_ALERT_COOLDOWN_HOURS)

        # Check odometer-based service due
        if last_service.next_service_odometer and odometer_km > 0:
            due_km = last_service.next_service_odometer / 1000.0
            km_remaining = due_km - odometer_km
            if km_remaining <= 0:
                overdue_km = abs(km_remaining)
                self._create_maintenance_alert(
                    vehicle=vehicle,
                    alert_type=FleetAlert.AlertType.SERVICE_DUE,
                    severity=FleetAlert.Severity.CRITICAL,
                    message=(
                        f"{vehicle.vehicle_no} service OVERDUE by {overdue_km:.0f} km "
                        f"(due at {due_km:.0f} km, current {odometer_km:.0f} km)"
                    ),
                    cooldown=cooldown,
                    now=now,
                )
            elif km_remaining <= self.SERVICE_DUE_KM_WARNING:
                severity = (FleetAlert.Severity.HIGH if km_remaining <= self.SERVICE_DUE_KM_CRITICAL
                            else FleetAlert.Severity.MEDIUM)
                self._create_maintenance_alert(
                    vehicle=vehicle,
                    alert_type=FleetAlert.AlertType.SERVICE_DUE,
                    severity=severity,
                    message=(
                        f"{vehicle.vehicle_no} service due in {km_remaining:.0f} km "
                        f"(at {due_km:.0f} km, current {odometer_km:.0f} km)"
                    ),
                    cooldown=cooldown,
                    now=now,
                )

        # Check date-based service due
        if last_service.next_service_date:
            today = dt.date.today()
            days_left = (last_service.next_service_date - today).days
            if days_left <= 0:
                self._create_maintenance_alert(
                    vehicle=vehicle,
                    alert_type=FleetAlert.AlertType.SERVICE_DUE,
                    severity=FleetAlert.Severity.CRITICAL,
                    message=(
                        f"{vehicle.vehicle_no} service OVERDUE — was due {last_service.next_service_date} "
                        f"({abs(days_left)} days ago)"
                    ),
                    cooldown=cooldown,
                    now=now,
                )
            elif days_left <= self.SERVICE_DUE_DAYS_WARNING:
                self._create_maintenance_alert(
                    vehicle=vehicle,
                    alert_type=FleetAlert.AlertType.SERVICE_DUE,
                    severity=FleetAlert.Severity.HIGH if days_left <= 7 else FleetAlert.Severity.MEDIUM,
                    message=(
                        f"{vehicle.vehicle_no} service due in {days_left} day{'s' if days_left != 1 else ''} "
                        f"({last_service.next_service_date})"
                    ),
                    cooldown=cooldown,
                    now=now,
                )

    def _create_maintenance_alert(self, vehicle, alert_type, severity, message, cooldown, now):
        from .models import FleetAlert
        exists = FleetAlert.objects.filter(
            vehicle=vehicle,
            alert_type=alert_type,
            acknowledged=False,
            occurred_at__gte=cooldown,
        ).exists()
        if not exists:
            FleetAlert.objects.create(
                vehicle=vehicle,
                alert_type=alert_type,
                severity=severity,
                message=message,
                occurred_at=now,
            )

    def _create_alert_if_not_recent(self, vehicle, alert_type, severity, message, data, occurred_at):
        from .models import FleetAlert
        recent_window = timezone.now() - timedelta(minutes=self.ALERT_COOLDOWN_MINUTES)
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
        vehicle.last_latitude = data.get('latitude')
        vehicle.last_longitude = data.get('longitude')
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

    # ─────────────────────────────────────────────
    # Maintenance due check (standalone, for all vehicles)
    # ─────────────────────────────────────────────

    def check_all_maintenance_due(self):
        """Run maintenance due checks for all active vehicles (call from management command or view)."""
        from .models import Vehicle
        vehicles = Vehicle.objects.filter(is_active=True)
        alerts_created = 0
        for vehicle in vehicles:
            count_before = self._count_unacked_service_alerts(vehicle)
            self._check_maintenance_due(vehicle, {'odometer': vehicle.last_odometer or 0})
            count_after = self._count_unacked_service_alerts(vehicle)
            alerts_created += max(0, count_after - count_before)
        return {'vehicles_checked': vehicles.count(), 'alerts_created': alerts_created}

    def _count_unacked_service_alerts(self, vehicle):
        from .models import FleetAlert
        return FleetAlert.objects.filter(
            vehicle=vehicle,
            alert_type=FleetAlert.AlertType.SERVICE_DUE,
            acknowledged=False,
        ).count()

    # ─────────────────────────────────────────────
    # TrackNTrace alert sync
    # ─────────────────────────────────────────────

    def fetch_trackntrace_alerts(self, date_from, date_to):
        """
        Pull alert events from the TrackNTrace/Trakzee API and store them as FleetAlerts.
        Tries multiple alert-related endpoints.
        """
        from .models import FleetAPIConfig, Vehicle, FleetAlert
        config = FleetAPIConfig.objects.filter(is_active=True).first()
        if not config:
            return {'error': 'No active fleet config'}

        token = self._get_token(config)
        vehicles = list(Vehicle.objects.filter(is_active=True, api_config=config))
        vehicle_nos = ','.join(v.vehicle_no for v in vehicles)
        vehicle_map = {v.vehicle_no.upper(): v for v in vehicles}
        headers = {'auth-code': token}

        def reformat(d):
            try:
                return datetime.strptime(d, '%Y-%m-%d').strftime('%d-%m-%Y')
            except Exception:
                return d

        date_from_fmt = reformat(date_from)
        date_to_fmt = reformat(date_to)

        alert_endpoints = [
            f'getAlertHistory&ProjectId={config.project_id}',
            f'getAlerts&ProjectId={config.project_id}',
            f'getAlertData&ProjectId={config.project_id}',
            f'getTokenBaseAlertData&ProjectId={config.project_id}',
            f'getNotificationHistory&ProjectId={config.project_id}',
            f'getEventHistory&ProjectId={config.project_id}',
            f'getEventData&ProjectId={config.project_id}',
        ]

        payload_variants = [
            {'company_names': config.company_name, 'vehicle_nos': vehicle_nos, 'from_date': date_from_fmt, 'to_date': date_to_fmt, 'format': 'json'},
            {'company_names': config.company_name, 'vehicle_nos': vehicle_nos, 'fromdate': date_from_fmt, 'todate': date_to_fmt, 'format': 'json'},
            {'company_names': config.company_name, 'vehicle_nos': vehicle_nos, 'start_date': date_from_fmt, 'end_date': date_to_fmt, 'format': 'json'},
        ]

        debug_responses = []
        raw_response = None
        used_endpoint = None

        for ep in alert_endpoints:
            url = f"{config.base_url}/webservice?token={ep}"
            for payload in payload_variants:
                try:
                    resp = requests.post(url, json=payload, headers=headers, timeout=30)
                    if resp.status_code == 200:
                        data = resp.json()
                        debug_responses.append({'endpoint': ep, 'status': 200, 'keys': list(data.keys()) if isinstance(data, dict) else 'list'})
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
                'error': 'No alert endpoint found in TrackNTrace API.',
                'debug_responses': debug_responses,
                'alerts_imported': 0,
            }

        # Extract alert list from various shapes
        alert_list = (
            raw_response.get('root', {}).get('AlertData', [])
            or raw_response.get('root', {}).get('Data', [])
            or raw_response.get('AlertData', [])
            or raw_response.get('Data', [])
            or (raw_response if isinstance(raw_response, list) else [])
        )

        # Alert type mapping from TrackNTrace names → our FleetAlert.AlertType
        TYPE_MAP = {
            'speeding':        FleetAlert.AlertType.SPEEDING,
            'overspeed':       FleetAlert.AlertType.SPEEDING,
            'speed':           FleetAlert.AlertType.SPEEDING,
            'sos':             FleetAlert.AlertType.SOS,
            'emergency':       FleetAlert.AlertType.SOS,
            'fuel fill':       FleetAlert.AlertType.FUEL_FILL,
            'fuel_fill':       FleetAlert.AlertType.FUEL_FILL,
            'refill':          FleetAlert.AlertType.FUEL_FILL,
            'fuel drain':      FleetAlert.AlertType.FUEL_DRAIN,
            'fuel_drain':      FleetAlert.AlertType.FUEL_DRAIN,
            'fuel theft':      FleetAlert.AlertType.FUEL_DRAIN,
            'theft':           FleetAlert.AlertType.FUEL_DRAIN,
            'low fuel':        FleetAlert.AlertType.LOW_FUEL,
            'low_fuel':        FleetAlert.AlertType.LOW_FUEL,
            'idle':            FleetAlert.AlertType.IDLE_LONG,
            'long idle':       FleetAlert.AlertType.IDLE_LONG,
            'ignition off':    FleetAlert.AlertType.IGNITION_OFF_MOVING,
            'geofence':        FleetAlert.AlertType.GEOFENCE,
            'offline':         FleetAlert.AlertType.DEVICE_OFFLINE,
            'device offline':  FleetAlert.AlertType.DEVICE_OFFLINE,
        }
        SEV_MAP = {
            'critical': FleetAlert.Severity.CRITICAL,
            'high':     FleetAlert.Severity.HIGH,
            'medium':   FleetAlert.Severity.MEDIUM,
            'low':      FleetAlert.Severity.LOW,
        }

        def _dt(val):
            if not val:
                return None
            for fmt in ('%d-%m-%Y %H:%M:%S', '%Y-%m-%d %H:%M:%S', '%d/%m/%Y %H:%M:%S'):
                try:
                    dt = datetime.strptime(str(val).strip(), fmt)
                    return timezone.make_aware(dt) if timezone.is_naive(dt) else dt
                except ValueError:
                    continue
            return None

        alerts_imported = 0
        for item in alert_list:
            vehicle_no = (item.get('Vehicle_No') or item.get('vehicle_no') or '').strip().upper()
            vehicle = vehicle_map.get(vehicle_no)
            if not vehicle:
                continue

            occurred_at = _dt(
                item.get('AlertTime') or item.get('Datetime') or
                item.get('datetime') or item.get('Date_Time') or item.get('Time')
            )
            if not occurred_at:
                continue

            raw_type = str(item.get('AlertType') or item.get('alert_type') or item.get('Event') or '').lower().strip()
            alert_type = FleetAlert.AlertType.COMPLIANCE_ISSUE  # default fallback
            for key, val in TYPE_MAP.items():
                if key in raw_type:
                    alert_type = val
                    break

            raw_sev = str(item.get('Severity') or item.get('severity') or '').lower().strip()
            severity = SEV_MAP.get(raw_sev, FleetAlert.Severity.MEDIUM)

            message = str(item.get('Message') or item.get('message') or item.get('Description') or f"{raw_type} alert on {vehicle.vehicle_no}").strip()

            # Deduplicate: same vehicle + type + within 10 minutes
            window = occurred_at - timedelta(minutes=10)
            exists = FleetAlert.objects.filter(
                vehicle=vehicle,
                alert_type=alert_type,
                occurred_at__gte=window,
                occurred_at__lte=occurred_at + timedelta(minutes=10),
            ).exists()
            if not exists:
                FleetAlert.objects.create(
                    vehicle=vehicle,
                    alert_type=alert_type,
                    severity=severity,
                    message=message,
                    latitude=None,
                    longitude=None,
                    occurred_at=occurred_at,
                )
                alerts_imported += 1

        return {
            'endpoint_used': used_endpoint,
            'alerts_in_response': len(alert_list),
            'alerts_imported': alerts_imported,
            'debug_responses': debug_responses[:5],
        }

    # ─────────────────────────────────────────────
    # Trip history import
    # ─────────────────────────────────────────────

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

        def reformat(d):
            try:
                return datetime.strptime(d, '%Y-%m-%d').strftime('%d-%m-%Y')
            except Exception:
                return d

        date_from_fmt = reformat(date_from)
        date_to_fmt = reformat(date_to)

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
                        keys = set(data.keys()) if isinstance(data, dict) else set()
                        if keys - {'RESULT', 'MSG', 'result', 'msg'}:
                            raw_response = data
                            used_endpoint = ep
                            break
                        if raw_response is None:
                            raw_response = data
                            used_endpoint = ep
                except Exception as e:
                    debug_responses.append({'endpoint': ep, 'error': str(e)})
            if raw_response is not None and set(raw_response.keys() if isinstance(raw_response, dict) else []) - {'RESULT', 'MSG', 'result', 'msg'}:
                break

        if raw_response is None:
            return {'error': 'None of the history endpoints responded successfully.', 'tried': endpoints_to_try, 'debug': debug_responses}

        if isinstance(raw_response, dict) and set(raw_response.keys()) <= {'RESULT', 'MSG', 'result', 'msg'}:
            return {
                'endpoint_used': used_endpoint,
                'error': f"API returned error: {raw_response}",
                'trips_in_response': 0,
                'trips_imported': 0,
            }

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

    # ─────────────────────────────────────────────
    # Fuel events import from API
    # ─────────────────────────────────────────────

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
                return datetime.strptime(d, '%Y-%m-%d').strftime('%d-%m-%Y')
            except Exception:
                return d

        date_from_fmt = reformat(date_from)
        date_to_fmt = reformat(date_to)

        fuel_endpoints = [
            f'getFuelFillData&ProjectId={config.project_id}',
            f'getFuelFillEvent&ProjectId={config.project_id}',
            f'getFuelFillHistory&ProjectId={config.project_id}',
            f'getTokenBaseFuelData&ProjectId={config.project_id}',
            f'getFuelEventHistory&ProjectId={config.project_id}',
            f'getTokenBaseFuelFillData&ProjectId={config.project_id}',
            f'getFuelAlert&ProjectId={config.project_id}',
            f'getAlertHistory&ProjectId={config.project_id}',
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
                'error': 'No fuel event endpoint found.',
                'debug_responses': debug_responses,
                'events_imported': 0,
            }

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
                    dt = datetime.strptime(str(val).strip(), fmt)
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
            fuel_after = _float(e.get('After_Fuel') or e.get('after_fuel') or e.get('FuelAfter') or e.get('Fuel_After'))
            fuel_change = _float(e.get('Fuel_Change') or e.get('fuel_change') or e.get('FuelChange'))

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
                    'fuel_unit': 'L',
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

    # ─────────────────────────────────────────────
    # Vehicle details probe
    # ─────────────────────────────────────────────

    def fetch_vehicle_details(self, vehicle_no=None):
        from .models import FleetAPIConfig, Vehicle
        config = FleetAPIConfig.objects.filter(is_active=True).first()
        if not config:
            return {'error': 'No active fleet config'}

        token = self._get_token(config)
        headers = {'auth-code': token}

        if not vehicle_no:
            first_vehicle = Vehicle.objects.filter(is_active=True, api_config=config).first()
            vehicle_no = first_vehicle.vehicle_no if first_vehicle else ''

        payload = {'company_names': config.company_name, 'vehicle_nos': vehicle_no, 'format': 'json'}
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

    # ─────────────────────────────────────────────
    # Backfill from snapshots
    # ─────────────────────────────────────────────

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

            TripRecord.objects.filter(vehicle=vehicle).delete()
            FuelEvent.objects.filter(vehicle=vehicle).delete()

            open_trip = None
            prev = snapshots[0]
            for snap in snapshots[1:]:
                snap_ign = snap.ignition_on or (snap.status.upper() in ('MOVING', 'IDLE', 'ON') if snap.status else False)
                prev_ign = prev.ignition_on or (prev.status.upper() in ('MOVING', 'IDLE', 'ON') if prev.status else False)

                # Fuel detection — normalize to litres
                pf_raw = float(prev.fuel_level) if prev.fuel_level is not None else None
                nf_raw = float(snap.fuel_level) if snap.fuel_level is not None else None
                pf_unit = getattr(prev, 'fuel_unit', None) or vehicle.fuel_sensor_unit or '%'
                nf_unit = getattr(snap, 'fuel_unit', None) or vehicle.fuel_sensor_unit or '%'

                pf, pf_ok = self._to_litres(pf_raw, pf_unit, vehicle)
                nf, nf_ok = self._to_litres(nf_raw, nf_unit, vehicle)
                now_ts = snap.device_datetime or snap.fetched_at

                if pf is not None and nf is not None and pf_ok and nf_ok:
                    change = nf - pf
                    if change >= self.FUEL_FILL_THRESHOLD_L:
                        FuelEvent.objects.create(
                            vehicle=vehicle,
                            event_type=FuelEvent.EventType.FILL,
                            occurred_at=now_ts,
                            location_name=snap.location_name or '',
                            latitude=float(snap.latitude) if snap.latitude else None,
                            longitude=float(snap.longitude) if snap.longitude else None,
                            fuel_before=round(pf, 1),
                            fuel_after=round(nf, 1),
                            fuel_change=round(change, 1),
                            fuel_unit='L',
                        )
                        fuel_events_created += 1
                    elif change <= -self.FUEL_DRAIN_THRESHOLD_L and not snap_ign:
                        etype = FuelEvent.EventType.THEFT if abs(change) >= self.THEFT_THRESHOLD_L else FuelEvent.EventType.DRAIN
                        FuelEvent.objects.create(
                            vehicle=vehicle,
                            event_type=etype,
                            occurred_at=now_ts,
                            location_name=snap.location_name or '',
                            latitude=float(snap.latitude) if snap.latitude else None,
                            longitude=float(snap.longitude) if snap.longitude else None,
                            fuel_before=round(pf, 1),
                            fuel_after=round(nf, 1),
                            fuel_change=round(change, 1),
                            fuel_unit='L',
                        )
                        fuel_events_created += 1

                # Trip detection
                if not prev_ign and snap_ign:
                    open_trip = TripRecord.objects.create(
                        vehicle=vehicle,
                        started_at=now_ts,
                        start_location=snap.location_name or '',
                        start_latitude=float(snap.latitude) if snap.latitude else None,
                        start_longitude=float(snap.longitude) if snap.longitude else None,
                        start_odometer=snap.odometer or 0,
                        driver_name=snap.driver_name or '',
                    )
                    trips_created += 1
                elif prev_ign and not snap_ign and open_trip:
                    end_odo = snap.odometer or 0
                    dist_km = round(max(0, end_odo - open_trip.start_odometer) / 1000, 2)
                    dur_min = int((now_ts - open_trip.started_at).total_seconds() / 60) if now_ts > open_trip.started_at else 0
                    open_trip.ended_at = now_ts
                    open_trip.end_location = snap.location_name or ''
                    open_trip.end_latitude = float(snap.latitude) if snap.latitude else None
                    open_trip.end_longitude = float(snap.longitude) if snap.longitude else None
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
