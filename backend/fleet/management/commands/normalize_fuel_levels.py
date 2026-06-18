"""
One-time migration to normalize raw ADC fuel values (0-4095) stored before the
parse_fuel fix. Values > 100 are assumed to be raw ADC; values ≤ 100 are already
percentage or actual litres and are left alone.

Also deletes FuelEvents whose fuel_before or fuel_after exceeds 100, since those
were created from bad comparisons between raw ADC and normalized data.
"""
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Normalize raw ADC fuel values and purge false fuel events'

    def handle(self, *args, **options):
        from fleet.models import Vehicle, VehicleLiveData, FuelEvent

        with transaction.atomic():
            # Normalize VehicleLiveData records with raw ADC fuel (> 100)
            raw_snapshots = VehicleLiveData.objects.filter(fuel_level__gt=100)
            count = raw_snapshots.count()
            self.stdout.write(f'Normalizing {count} VehicleLiveData records...')
            updated = 0
            for snap in raw_snapshots.iterator():
                snap.fuel_level = round(float(snap.fuel_level) / 4095.0 * 100, 1)
                snap.save(update_fields=['fuel_level'])
                updated += 1
            self.stdout.write(self.style.SUCCESS(f'  Updated {updated} snapshots'))

            # Fix Vehicle.last_fuel cache where > 100
            raw_vehicles = Vehicle.objects.filter(last_fuel__gt=100)
            vcount = raw_vehicles.count()
            self.stdout.write(f'Fixing {vcount} vehicle last_fuel caches...')
            for v in raw_vehicles:
                v.last_fuel = round(float(v.last_fuel) / 4095.0 * 100, 1)
                v.save(update_fields=['last_fuel'])
            self.stdout.write(self.style.SUCCESS(f'  Fixed {vcount} vehicles'))

            # Delete false fuel events (created during the raw→normalized transition)
            bad_events = FuelEvent.objects.filter(
                fuel_before__gt=100
            ) | FuelEvent.objects.filter(
                fuel_after__gt=100
            ) | FuelEvent.objects.filter(
                fuel_change__gt=100
            ) | FuelEvent.objects.filter(
                fuel_change__lt=-100
            )
            ecount = bad_events.count()
            self.stdout.write(f'Deleting {ecount} false fuel events...')
            bad_events.delete()
            self.stdout.write(self.style.SUCCESS(f'  Deleted {ecount} events'))

        self.stdout.write(self.style.SUCCESS('Done. Run fleet_sync to get fresh normalized data.'))
