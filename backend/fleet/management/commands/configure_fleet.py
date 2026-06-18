"""
Management command to configure fleet vehicles with correct capacities,
clear stale ADC-based data, and seed known fuel fill events from PDF reports.

Usage:
    python manage.py configure_fleet
"""
from django.core.management.base import BaseCommand
from django.utils import timezone


FUEL_EVENTS = [
    # (vehicle_no, eat_datetime_str, location, fuel_before, fuel_after, fuel_diff)
    # EAT = UTC+3; stored as UTC (subtract 3h)
    # --- 17-06-2026 ---
    ('KHMA 460N', '17-06-2026 18:01:12', 'South Kinangop Kenya (SW)', 181.34, 275.42, 94.08),
    ('KHMA 460N', '17-06-2026 18:19:08', 'South Kinangop Kenya (SW)', 175.05, 300.0,  124.95),
    # --- 18-06-2026 ---
    ('KHMA 460N', '18-06-2026 08:13:49', 'South Kinangop Kenya (NW)',                 104.89, 194.76, 89.87),
    ('KHMA 460N', '18-06-2026 09:09:34', 'Village path Njabini Nyandarua Kenya (SW)', 121.35, 155.35, 34.0),
    ('KHMA 460N', '18-06-2026 09:44:55', 'Village path Njabini Nyandarua Kenya (SW)', 151.37, 300.0,  148.63),
    ('KHMA 460N', '18-06-2026 10:20:07', 'Village path Njabini Nyandarua Kenya (SW)', 114.31, 300.0,  185.69),
    ('KHMA 460N', '18-06-2026 11:10:43', 'Village path Njabini Nyandarua Kenya (SW)', 109.76, 147.54, 37.78),
    ('KHMA 460N', '18-06-2026 11:27:40', 'Village path Njabini Nyandarua Kenya (SW)', 91.22,  300.0,  208.78),
    ('KHMA 460N', '18-06-2026 12:04:10', 'Village path Njabini Nyandarua Kenya (SW)', 121.81, 223.64, 101.83),
    ('KHMA 460N', '18-06-2026 12:26:49', 'Village path Njabini Nyandarua Kenya (SW)', 114.92, 300.0,  185.08),
    ('KHMA 460N', '18-06-2026 12:59:26', 'Village path Njabini Nyandarua Kenya (SW)', 217.23, 291.65, 74.42),
    ('KHMA 460N', '18-06-2026 14:50:23', 'Village path Njabini Nyandarua Kenya (SW)', 100.9,  300.0,  199.1),
    ('KHMA 460N', '18-06-2026 16:13:37', 'South Kinangop Kenya (NW)',                 92.93,  135.73, 42.8),
    ('KHMA 460N', '18-06-2026 16:47:18', 'South Kinangop Kenya (NW)',                 88.2,   258.67, 170.47),
    ('KHMA 460N', '18-06-2026 17:01:43', 'South Kinangop Kenya (SW)',                 241.65, 300.0,  58.35),
    ('KDG 073K',  '18-06-2026 10:54:55', 'C68 Njabini Nyandarua Kenya (SE)',          8.07,   78.9,   70.83),
    ('KDU 999Y',  '18-06-2026 10:43:05', 'C68 Njabini Nyandarua Kenya (SW)',          7.09,   71.91,  64.82),
]


class Command(BaseCommand):
    help = 'Configure fleet vehicles, clear stale ADC-based data, and seed known fuel events'

    def handle(self, *args, **options):
        import pytz
        from datetime import datetime
        from fleet.models import Vehicle, FuelEvent, VehicleLiveData

        nairobi = pytz.timezone('Africa/Nairobi')

        self.stdout.write(self.style.MIGRATE_HEADING('=== Fleet Configuration ==='))

        # 1. Set fuel_capacity and fuel_sensor_unit for known vehicles
        capacity_map = {
            'KHMA 460N': 300,
            'KDG 073K':  80,
        }
        vehicles_updated = 0
        for vno, cap in capacity_map.items():
            updated = Vehicle.objects.filter(vehicle_no=vno).update(
                fuel_capacity=cap,
                fuel_sensor_unit='L',
            )
            if updated:
                self.stdout.write(f'  Set {vno}: fuel_capacity={cap}L, fuel_sensor_unit=L')
                vehicles_updated += updated
            else:
                self.stdout.write(self.style.WARNING(f'  Vehicle not found in DB: {vno}'))

        self.stdout.write(f'Vehicles updated: {vehicles_updated}')

        # 2. Delete ALL existing FuelEvent records (ADC-based, incorrect)
        fuel_deleted, _ = FuelEvent.objects.all().delete()
        self.stdout.write(f'Deleted {fuel_deleted} FuelEvent records (ADC-based/incorrect)')

        # 3. Delete ALL existing VehicleLiveData records (have wrong ADC-based fuel values)
        live_deleted, _ = VehicleLiveData.objects.all().delete()
        self.stdout.write(f'Deleted {live_deleted} VehicleLiveData records')

        # 4. Reset last_fuel on all vehicles to NULL
        reset_count = Vehicle.objects.all().update(last_fuel=None)
        self.stdout.write(f'Reset last_fuel to NULL on {reset_count} vehicles')

        # 5. Seed the 17 known fuel fill events (EAT -> UTC)
        vehicle_cache = {}
        events_created = 0
        events_skipped = 0

        for (vno, eat_str, location, before, after, diff) in FUEL_EVENTS:
            # Parse EAT datetime and convert to UTC
            eat_dt = datetime.strptime(eat_str, '%d-%m-%Y %H:%M:%S')
            eat_aware = timezone.make_aware(eat_dt, nairobi)
            utc_dt = eat_aware.astimezone(pytz.utc)

            # Get vehicle (cache to avoid repeated DB hits)
            if vno not in vehicle_cache:
                try:
                    vehicle_cache[vno] = Vehicle.objects.get(vehicle_no=vno)
                except Vehicle.DoesNotExist:
                    self.stdout.write(self.style.WARNING(f'  Skipping event: vehicle {vno} not found in DB'))
                    vehicle_cache[vno] = None
                    events_skipped += 1
                    continue

            vehicle = vehicle_cache[vno]
            if vehicle is None:
                events_skipped += 1
                continue

            obj, created = FuelEvent.objects.get_or_create(
                vehicle=vehicle,
                occurred_at=utc_dt,
                defaults={
                    'event_type': FuelEvent.EventType.FILL,
                    'location_name': location,
                    'fuel_before': before,
                    'fuel_after': after,
                    'fuel_change': diff,
                },
            )
            if created:
                events_created += 1
                self.stdout.write(
                    f'  Created: {vno} @ {eat_str} EAT  +{diff}L  ({before}->{after}L)'
                )
            else:
                events_skipped += 1

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=== Summary ==='))
        self.stdout.write(f'  Vehicles configured:              {vehicles_updated}')
        self.stdout.write(f'  FuelEvents deleted (ADC-based):   {fuel_deleted}')
        self.stdout.write(f'  VehicleLiveData records deleted:  {live_deleted}')
        self.stdout.write(f'  Vehicles last_fuel reset to NULL: {reset_count}')
        self.stdout.write(f'  Fuel events seeded (created):     {events_created}')
        self.stdout.write(f'  Fuel events skipped (duplicate):  {events_skipped}')
        self.stdout.write(self.style.SUCCESS('Done.'))
