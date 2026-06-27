from django.core.management.base import BaseCommand
from hr.models import LeaveType

LEAVE_TYPES = [
    # (name, code, days, is_paid, applicable_to)
    ('Annual Leave',         'AL',  21,  True,  'all'),
    ('Sick Leave',           'SL',  10,  True,  'all'),
    ('Maternity Leave',      'ML',  90,  True,  'staff_only'),
    ('Paternity Leave',      'PL',  14,  True,  'staff_only'),
    ('Compassionate Leave',  'CL',   5,  True,  'all'),
    ('Study Leave',          'STL',  5,  True,  'staff_only'),
    ('Unpaid Leave',         'UL',   0,  False, 'all'),
    ('Emergency Leave',      'EL',   3,  True,  'all'),
    ('Public Holiday',       'PH',   0,  True,  'all'),
    ('Half Day Leave',       'HDL',  0,  True,  'all'),
]


class Command(BaseCommand):
    help = 'Seed standard leave types'

    def handle(self, *args, **options):
        for name, code, days, paid, applicable in LEAVE_TYPES:
            lt, created = LeaveType.objects.get_or_create(
                code=code,
                defaults={
                    'name': name,
                    'days_entitled': days,
                    'is_paid': paid,
                    'applicable_to': applicable,
                    'is_active': True,
                }
            )
            if created:
                self.stdout.write(f'  Created: {name}')
            else:
                self.stdout.write(f'  Exists:  {name}')
        self.stdout.write(self.style.SUCCESS('Leave types seeded.'))
