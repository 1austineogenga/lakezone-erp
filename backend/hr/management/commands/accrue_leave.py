"""
Management command: accrue_leave

Run monthly (e.g. via cron on the last day of the month) to credit employees
with their monthly leave accrual.

Usage:
    python manage.py accrue_leave
    python manage.py accrue_leave --year 2024 --month 6
    python manage.py accrue_leave --dry-run

Accrual logic:
    - Only affects LeaveTypes with code 'AL' (annual leave) that are applicable
      to each employee's employment type.
    - Monthly accrual = leave_type.days_entitled / 12  (default 21/12 = 1.75 days)
    - Creates or updates LeaveBalance for the current calendar year.
    - Employees hired in the current month get a prorated amount (days_remaining / days_in_month).
    - Terminated or inactive employees are skipped.
"""

from datetime import date
import calendar

from django.core.management.base import BaseCommand, CommandError

from hr.models import Employee, LeaveType, LeaveBalance


class Command(BaseCommand):
    help = 'Accrue monthly leave for all active employees.'

    def add_arguments(self, parser):
        today = date.today()
        parser.add_argument('--year',  type=int, default=today.year,
                            help='Year to accrue for (default: current year)')
        parser.add_argument('--month', type=int, default=today.month,
                            help='Month to accrue for (default: current month)')
        parser.add_argument('--dry-run', action='store_true',
                            help='Print what would happen without saving.')

    def handle(self, *args, **options):
        year     = options['year']
        month    = options['month']
        dry_run  = options['dry_run']

        if not (1 <= month <= 12):
            raise CommandError('--month must be between 1 and 12.')

        days_in_month = calendar.monthrange(year, month)[1]
        run_date      = date(year, month, days_in_month)

        # Fetch annual leave types
        leave_types = list(LeaveType.objects.filter(is_active=True))
        if not leave_types:
            self.stdout.write(self.style.WARNING('No active leave types found.'))
            return

        employees = Employee.objects.filter(is_active=True).select_related('position')
        accrued_count = 0

        for emp in employees:
            # Skip employees hired after this accrual period
            if emp.date_hired > run_date:
                continue

            for lt in leave_types:
                # Check applicability
                if lt.applicable_to == 'staff_only' and emp.employment_type != 'staff':
                    continue
                if lt.applicable_to == 'casual_only' and emp.employment_type != 'casual':
                    continue

                monthly_accrual = float(lt.days_entitled) / 12.0

                # Prorate for employees hired during this month
                hire_month_start = date(year, month, 1)
                if emp.date_hired >= hire_month_start:
                    days_employed = (run_date - emp.date_hired).days + 1
                    monthly_accrual = monthly_accrual * (days_employed / days_in_month)

                monthly_accrual = round(monthly_accrual, 4)

                if dry_run:
                    self.stdout.write(
                        f'[DRY RUN] {emp.employee_number} {emp.full_name}: '
                        f'+{monthly_accrual:.4f} days ({lt.name})'
                    )
                    continue

                balance, created = LeaveBalance.objects.get_or_create(
                    employee=emp,
                    leave_type=lt,
                    year=year,
                    defaults={'entitled_days': monthly_accrual},
                )
                if not created:
                    balance.entitled_days = round(float(balance.entitled_days) + monthly_accrual, 4)
                    balance.save(update_fields=['entitled_days'])

                accrued_count += 1
                self.stdout.write(
                    f'{emp.employee_number} {emp.full_name}: '
                    f'+{monthly_accrual:.4f} days ({lt.name}) → '
                    f'balance {balance.entitled_days}'
                )

        if not dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Leave accrual complete for {year}-{month:02d}. '
                    f'{accrued_count} balance(s) updated.'
                )
            )
        else:
            self.stdout.write(self.style.WARNING('Dry run complete — no changes saved.'))
