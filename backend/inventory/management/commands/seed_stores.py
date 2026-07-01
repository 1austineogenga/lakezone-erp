from django.core.management.base import BaseCommand
from core.models import Department
from inventory.models import Store


class Command(BaseCommand):
    help = 'Create one store per active department (skips if a store with the same name already exists)'

    def handle(self, *args, **options):
        departments = Department.objects.filter(is_active=True).order_by('name')
        if not departments.exists():
            self.stdout.write(self.style.WARNING('No active departments found. Run this after departments are seeded.'))
            return

        created = 0
        skipped = 0
        for dept in departments:
            store_name = f"{dept.name} Store"
            _, was_created = Store.objects.get_or_create(
                name=store_name,
                defaults={
                    'location': dept.branch.name if dept.branch else '',
                    'is_active': True,
                }
            )
            if was_created:
                self.stdout.write(self.style.SUCCESS(f'  Created: {store_name}'))
                created += 1
            else:
                skipped += 1

        # Also create a General Store if none exists
        _, was_created = Store.objects.get_or_create(
            name='General Store',
            defaults={'location': 'Head Office', 'is_active': True}
        )
        if was_created:
            self.stdout.write(self.style.SUCCESS('  Created: General Store'))
            created += 1

        self.stdout.write(self.style.SUCCESS(
            f'\nDone — {created} store(s) created, {skipped} already existed.'
        ))
