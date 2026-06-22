"""
Remove false fuel events caused by sensor bounce (momentary low readings).

A bounce is: a drain/theft event followed within 60 minutes by a fill event
of similar magnitude (fill >= 70% of drain). Both are sensor noise.
"""
from datetime import timedelta
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Delete false fuel events caused by sensor bounce patterns'

    def handle(self, *args, **options):
        from fleet.models import FuelEvent, FleetAlert, Vehicle

        deleted_events = 0
        deleted_alerts = 0

        for vehicle in Vehicle.objects.all():
            events = list(
                FuelEvent.objects.filter(vehicle=vehicle)
                .order_by('occurred_at')
            )

            to_delete_ids = set()

            for i, evt in enumerate(events):
                if evt.id in to_delete_ids:
                    continue
                if evt.event_type not in ('drain', 'theft'):
                    continue

                drain_magnitude = abs(float(evt.fuel_change))
                window_end = evt.occurred_at + timedelta(minutes=60)

                for j in range(i + 1, len(events)):
                    fill = events[j]
                    if fill.occurred_at > window_end:
                        break
                    if fill.event_type != 'fill':
                        continue
                    fill_magnitude = float(fill.fuel_change)
                    if fill_magnitude >= drain_magnitude * 0.7:
                        to_delete_ids.add(evt.id)
                        to_delete_ids.add(fill.id)
                        self.stdout.write(
                            f"  {vehicle.vehicle_no}: bounce pair "
                            f"{evt.event_type} {evt.occurred_at:%Y-%m-%d %H:%M} "
                            f"({float(evt.fuel_change):.1f}) <-> fill "
                            f"{fill.occurred_at:%Y-%m-%d %H:%M} "
                            f"(+{fill_magnitude:.1f})"
                        )
                        break

            if to_delete_ids:
                for evt_id in list(to_delete_ids):
                    try:
                        evt = FuelEvent.objects.get(id=evt_id)
                        window_start = evt.occurred_at - timedelta(minutes=5)
                        window_end = evt.occurred_at + timedelta(minutes=5)
                        n, _ = FleetAlert.objects.filter(
                            vehicle=vehicle,
                            alert_type__in=['fuel_drain', 'fuel_fill'],
                            occurred_at__range=(window_start, window_end),
                        ).delete()
                        deleted_alerts += n
                    except FuelEvent.DoesNotExist:
                        pass

                n, _ = FuelEvent.objects.filter(id__in=to_delete_ids).delete()
                deleted_events += n

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. Removed {deleted_events} false fuel events and {deleted_alerts} related alerts.'
        ))
