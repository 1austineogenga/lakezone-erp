from django.core.management.base import BaseCommand
from fleet.services import FleetSyncService
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Sync fleet live data from API. Run as cron: */2 * * * * python manage.py fleet_sync'

    def add_arguments(self, parser):
        parser.add_argument(
            '--config-id',
            type=int,
            help='Sync only a specific FleetAPIConfig by ID',
        )
        parser.add_argument(
            '--vehicle-no',
            type=str,
            help='Sync only a specific vehicle by vehicle_no',
        )

    def handle(self, *args, **options):
        service = FleetSyncService()
        config_id = options.get('config_id')
        vehicle_no = options.get('vehicle_no')

        try:
            if config_id:
                from fleet.models import FleetAPIConfig
                config = FleetAPIConfig.objects.get(id=config_id)
                count = service.sync_config(config)
                self.stdout.write(self.style.SUCCESS(f'Synced {count} vehicles for config {config_id}'))
            elif vehicle_no:
                from fleet.models import Vehicle
                vehicle = Vehicle.objects.get(vehicle_no=vehicle_no)
                if vehicle.api_config:
                    if vehicle.api_config.api_type == 'token_based':
                        token = service._get_token(vehicle.api_config)
                        raw_list = service._fetch_token_based(vehicle.api_config, [vehicle])
                        for raw in raw_list:
                            if raw.get('Vehicle_No') == vehicle_no:
                                data = service._parse_vehicle_data(raw)
                                service._process_vehicle(vehicle, data)
                                self.stdout.write(self.style.SUCCESS(f'Synced vehicle {vehicle_no}'))
                                break
                    else:
                        raw = service._fetch_vehicle_wise(vehicle.api_config, vehicle)
                        data = service._parse_vehicle_data(raw)
                        service._process_vehicle(vehicle, data)
                        self.stdout.write(self.style.SUCCESS(f'Synced vehicle {vehicle_no}'))
                else:
                    self.stdout.write(self.style.ERROR(f'Vehicle {vehicle_no} has no API config'))
            else:
                results = service.sync_all()
                total_synced = sum(r.get('synced', 0) for r in results if r.get('success'))
                total_configs = len(results)
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Sync complete: {total_synced} vehicles across {total_configs} configs'
                    )
                )
                for r in results:
                    if not r.get('success'):
                        self.stdout.write(self.style.ERROR(f"Config {r['config_id']} failed: {r.get('error')}"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Fleet sync failed: {e}'))
            logger.exception('Fleet sync management command failed')
            raise
