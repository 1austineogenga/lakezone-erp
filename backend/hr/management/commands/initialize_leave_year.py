from datetime import datetime
from decimal import Decimal
from django.core.management.base import BaseCommand
from hr.models import Employee, LeaveType, LeaveBalance


class Command(BaseCommand):
    help = 'Initialize leave balances for all active employees for a given year.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--year', type=int, default=None,
            help='Year to initialize (defaults to current year)',
        )

    def handle(self, *args, **options):
        year = options['year'] or datetime.now().year
        self.stdout.write(f'Initializing leave balances for {year}…')

        employees   = Employee.objects.filter(is_active=True)
        leave_types = LeaveType.objects.filter(is_active=True)

        created_count = 0
        skipped_count = 0

        for emp in employees:
            for lt in leave_types:
                carried = Decimal('0')
                if lt.carry_forward:
                    try:
                        prev = LeaveBalance.objects.get(employee=emp, leave_type=lt, year=year - 1)
                        remaining = prev.entitled_days + prev.carried_forward - prev.taken_days
                        carried = min(max(remaining, Decimal('0')), Decimal(str(lt.max_carry_forward)))
                    except LeaveBalance.DoesNotExist:
                        pass

                _, created = LeaveBalance.objects.get_or_create(
                    employee=emp,
                    leave_type=lt,
                    year=year,
                    defaults={
                        'entitled_days':   lt.days_entitled,
                        'carried_forward': carried,
                        'taken_days':      Decimal('0'),
                    },
                )
                if created:
                    created_count += 1
                else:
                    skipped_count += 1

        self.stdout.write(self.style.SUCCESS(
            f'Done. Created {created_count} records, skipped {skipped_count} existing.'
        ))
