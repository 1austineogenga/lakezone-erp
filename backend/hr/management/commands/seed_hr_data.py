from django.core.management.base import BaseCommand
from core.models import Department, Branch
from hr.models import Position


DEPARTMENTS = [
    'Human Resource',
    'Finance',
    'Administration',
    'Information Technology',
    'Security and Surveillance',
    'Procurement',
    'Operations',
]

POSITIONS = [
    ('Managing Director',        None),
    ('HR Manager',               'Human Resource'),
    ('Accountant',               'Finance'),
    ('System Administrator',     'Information Technology'),
    ('Administration Officer',   'Administration'),
    ('Chief Security Officer',   'Security and Surveillance'),
    ('Surveillance Officer',     'Security and Surveillance'),
    ('Facility Manager',         'Administration'),
    ('Receptionist',             'Administration'),
    ('Cleaner',                  'Administration'),
    ('Chef',                     'Administration'),
    ('Site Manager',             'Operations'),
    ('Site Engineer',            'Operations'),
    ('Procurement Officer',      'Procurement'),
    ('Machine Operator',         'Operations'),
    ('Driver',                   'Operations'),
    ('Mechanic',                 'Operations'),
    ('Site Surveyor',            'Operations'),
    ('Welder',                   'Operations'),
    ('Foreman',                  'Operations'),
    ('Security Officer',         'Security and Surveillance'),
    ('Storekeeper',              'Procurement'),
]

BRANCHES = [
    ('Head Office', 'Athi River'),
]


class Command(BaseCommand):
    help = 'Seed HR departments, positions and head office branch'

    def handle(self, *args, **options):
        # Branches
        for name, location in BRANCHES:
            b, created = Branch.objects.get_or_create(name=name, defaults={'location': location, 'is_active': True})
            if created:
                self.stdout.write(f'  Created branch: {name}')
            else:
                self.stdout.write(f'  Branch exists: {name}')

        # Departments — find the first branch (head office) to assign
        head_office = Branch.objects.filter(name='Head Office').first()

        dept_map = {}
        for dept_name in DEPARTMENTS:
            d, created = Department.objects.get_or_create(
                name=dept_name,
                defaults={'branch': head_office, 'is_active': True}
            )
            dept_map[dept_name] = d
            if created:
                self.stdout.write(f'  Created department: {dept_name}')
            else:
                self.stdout.write(f'  Department exists: {dept_name}')

        # Positions
        for title, dept_name in POSITIONS:
            dept = dept_map.get(dept_name) if dept_name else None
            p, created = Position.objects.get_or_create(
                title=title,
                defaults={'department': dept, 'is_active': True}
            )
            if created:
                self.stdout.write(f'  Created position: {title}')
            else:
                self.stdout.write(f'  Position exists: {title}')

        self.stdout.write(self.style.SUCCESS('HR seed data complete.'))
