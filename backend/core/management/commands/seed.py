"""
Management command: python manage.py seed

Seeds the database with initial Lake Zone Enterprises data:
  - Branch
  - Departments
  - Leave types
  - Sample users (one per key role)
  - Sample projects
  - Sample stock items
  - Sample CRM clients
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from decimal import Decimal
import datetime


class Command(BaseCommand):
    help = 'Seed initial data for Lake Zone ERP'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear', action='store_true',
            help='Clear existing data before seeding (except superusers)',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING('\n=== Lake Zone ERP Seeder ===\n'))

        if options['clear']:
            self._clear()

        self._seed_branches()
        self._seed_departments()
        self._seed_leave_types()
        self._seed_users()
        self._seed_projects()
        self._seed_stock_items()
        self._seed_clients()

        self.stdout.write(self.style.SUCCESS('\n✓ Seeding complete!\n'))

    # ── Clear ─────────────────────────────────────────────────────────────────

    def _clear(self):
        from core.models import User, Branch, Department
        from hr.models import LeaveType
        from projects.models import Project
        from inventory.models import StockItem
        from crm.models import Client

        self.stdout.write('  Clearing existing data...')
        Client.objects.all().delete()
        StockItem.objects.all().delete()
        Project.objects.all().delete()
        LeaveType.objects.all().delete()
        User.objects.filter(is_superuser=False).delete()
        Department.objects.all().delete()
        Branch.objects.all().delete()
        self.stdout.write(self.style.WARNING('  ✓ Cleared\n'))

    # ── Branches ──────────────────────────────────────────────────────────────

    def _seed_branches(self):
        from core.models import Branch
        self.stdout.write('  Seeding branches...')

        branches = [
            {'name': 'Head Office',  'location': 'Nairobi'},
            {'name': 'Mombasa',      'location': 'Mombasa'},
            {'name': 'Kisumu',       'location': 'Kisumu'},
            {'name': 'Nakuru',       'location': 'Nakuru'},
        ]
        for b in branches:
            Branch.objects.get_or_create(name=b['name'], defaults={'location': b['location']})

        self.stdout.write(self.style.SUCCESS(f'  ✓ {len(branches)} branches'))

    # ── Departments ───────────────────────────────────────────────────────────

    def _seed_departments(self):
        from core.models import Branch, Department
        self.stdout.write('  Seeding departments...')

        hq = Branch.objects.filter(name='Head Office').first()
        if not hq:
            return

        depts = [
            'Administration',
            'Finance & Accounts',
            'Human Resources',
            'Procurement & Logistics',
            'Projects & Engineering',
            'Information Technology',
            'Sales & Marketing',
            'Fleet & Equipment',
            'Health, Safety & Environment',
        ]
        for name in depts:
            Department.objects.get_or_create(name=name, branch=hq)

        self.stdout.write(self.style.SUCCESS(f'  ✓ {len(depts)} departments'))

    # ── Leave Types ───────────────────────────────────────────────────────────

    def _seed_leave_types(self):
        from hr.models import LeaveType
        self.stdout.write('  Seeding leave types...')

        types = [
            {'name': 'Annual Leave',      'code': 'AL',  'days_entitled': 21, 'is_paid': True,  'carry_forward': True,  'max_carry_forward': 10},
            {'name': 'Sick Leave',        'code': 'SL',  'days_entitled': 14, 'is_paid': True,  'carry_forward': False, 'max_carry_forward': 0},
            {'name': 'Maternity Leave',   'code': 'ML',  'days_entitled': 90, 'is_paid': True,  'carry_forward': False, 'max_carry_forward': 0, 'applicable_to': 'staff_only'},
            {'name': 'Paternity Leave',   'code': 'PL',  'days_entitled': 14, 'is_paid': True,  'carry_forward': False, 'max_carry_forward': 0, 'applicable_to': 'staff_only'},
            {'name': 'Compassionate',     'code': 'CL',  'days_entitled': 5,  'is_paid': True,  'carry_forward': False, 'max_carry_forward': 0},
            {'name': 'Study Leave',       'code': 'STL', 'days_entitled': 7,  'is_paid': False, 'carry_forward': False, 'max_carry_forward': 0, 'applicable_to': 'staff_only'},
            {'name': 'Unpaid Leave',      'code': 'UL',  'days_entitled': 30, 'is_paid': False, 'carry_forward': False, 'max_carry_forward': 0},
            {'name': 'Emergency Leave',   'code': 'EL',  'days_entitled': 3,  'is_paid': True,  'carry_forward': False, 'max_carry_forward': 0},
        ]
        for t in types:
            LeaveType.objects.get_or_create(
                code=t['code'],
                defaults={
                    'name': t['name'],
                    'days_entitled': t['days_entitled'],
                    'is_paid': t['is_paid'],
                    'carry_forward': t['carry_forward'],
                    'max_carry_forward': t['max_carry_forward'],
                    'applicable_to': t.get('applicable_to', 'all'),
                    'is_active': True,
                }
            )
        self.stdout.write(self.style.SUCCESS(f'  ✓ {len(types)} leave types'))

    # ── Users ─────────────────────────────────────────────────────────────────

    def _seed_users(self):
        from core.models import User, Branch, Department
        self.stdout.write('  Seeding users...')

        hq     = Branch.objects.filter(name='Head Office').first()
        fin    = Department.objects.filter(name='Finance & Accounts').first()
        hr_dep = Department.objects.filter(name='Human Resources').first()
        proc   = Department.objects.filter(name='Procurement & Logistics').first()
        proj   = Department.objects.filter(name='Projects & Engineering').first()
        it_dep = Department.objects.filter(name='Information Technology').first()

        users = [
            {'email': 'ceo@lakezone.ke',        'first_name': 'Chief',    'last_name': 'Executive',    'role': 'ceo',               'department': None,    'password': 'LZ@CEO2026'},
            {'email': 'finance@lakezone.ke',     'first_name': 'Finance',  'last_name': 'Manager',      'role': 'finance_manager',   'department': fin,     'password': 'LZ@Finance2026'},
            {'email': 'hr@lakezone.ke',          'first_name': 'HR',       'last_name': 'Manager',      'role': 'hr_manager',        'department': hr_dep,  'password': 'LZ@HR2026'},
            {'email': 'procurement@lakezone.ke', 'first_name': 'Proc',     'last_name': 'Manager',      'role': 'procurement_manager','department': proc,   'password': 'LZ@Proc2026'},
            {'email': 'pm@lakezone.ke',          'first_name': 'Project',  'last_name': 'Manager',      'role': 'project_manager',   'department': proj,    'password': 'LZ@PM2026'},
            {'email': 'engineer@lakezone.ke',    'first_name': 'Site',     'last_name': 'Engineer',     'role': 'site_engineer',     'department': proj,    'password': 'LZ@Eng2026'},
            {'email': 'store@lakezone.ke',       'first_name': 'Store',    'last_name': 'Keeper',       'role': 'store_keeper',      'department': proc,    'password': 'LZ@Store2026'},
            {'email': 'accounts@lakezone.ke',    'first_name': 'Accounts', 'last_name': 'Officer',      'role': 'accountant',        'department': fin,     'password': 'LZ@Acc2026'},
            {'email': 'it@lakezone.ke',          'first_name': 'IT',       'last_name': 'Officer',      'role': 'it_admin',          'department': it_dep,  'password': 'LZ@IT2026'},
            {'email': 'staff@lakezone.ke',       'first_name': 'General',  'last_name': 'Staff',        'role': 'staff',             'department': None,    'password': 'LZ@Staff2026'},
        ]

        created = 0
        for u in users:
            if not User.objects.filter(email=u['email']).exists():
                user = User.objects.create_user(
                    email=u['email'],
                    password=u['password'],
                    first_name=u['first_name'],
                    last_name=u['last_name'],
                    role=u['role'],
                    branch=hq,
                    department=u['department'],
                    is_active=True,
                )
                created += 1

        self.stdout.write(self.style.SUCCESS(f'  ✓ {created} users created'))
        if created:
            self.stdout.write(self.style.WARNING(
                '  Passwords follow pattern LZ@Role2026 — change after first login!'
            ))

    # ── Projects ──────────────────────────────────────────────────────────────

    def _seed_projects(self):
        from projects.models import Project
        self.stdout.write('  Seeding projects...')

        projects = [
            {
                'code': 'LZ-001',
                'name': 'Nairobi Office Block Construction',
                'client': 'Kenya National Housing Corporation',
                'contract_number': 'KNHC/2025/001',
                'contract_value': Decimal('45000000.00'),
                'location': 'Nairobi CBD',
                'status': 'active',
                'start_date': datetime.date(2025, 3, 1),
                'end_date': datetime.date(2026, 9, 30),
            },
            {
                'code': 'LZ-002',
                'name': 'Mombasa Road Rehabilitation',
                'client': 'Kenya National Highways Authority',
                'contract_number': 'KENHA/2025/047',
                'contract_value': Decimal('120000000.00'),
                'location': 'Mombasa Road, Nairobi',
                'status': 'active',
                'start_date': datetime.date(2025, 6, 1),
                'end_date': datetime.date(2027, 5, 31),
            },
            {
                'code': 'LZ-003',
                'name': 'Kisumu Water Treatment Plant',
                'client': 'Lake Victoria South Water Services',
                'contract_number': 'LVSWSB/2025/012',
                'contract_value': Decimal('78500000.00'),
                'location': 'Kisumu',
                'status': 'planning',
                'start_date': datetime.date(2026, 1, 1),
                'end_date': datetime.date(2027, 12, 31),
            },
            {
                'code': 'LZ-004',
                'name': 'Staff Quarters Renovation',
                'client': 'Lake Zone Enterprises Ltd',
                'contract_number': 'INTERNAL/2025/001',
                'contract_value': Decimal('3500000.00'),
                'location': 'Nairobi',
                'status': 'completed',
                'start_date': datetime.date(2025, 1, 1),
                'end_date': datetime.date(2025, 6, 30),
            },
        ]

        created = 0
        for p in projects:
            _, c = Project.objects.get_or_create(code=p['code'], defaults=p)
            if c:
                created += 1

        self.stdout.write(self.style.SUCCESS(f'  ✓ {created} projects'))

    # ── Stock Items ───────────────────────────────────────────────────────────

    def _seed_stock_items(self):
        from inventory.models import StockItem
        self.stdout.write('  Seeding stock items...')

        items = [
            # Materials
            {'item_code': 'MAT-001', 'name': 'Cement (50kg bag)',           'category': 'material',   'unit': 'Bag',    'reorder_level': 100},
            {'item_code': 'MAT-002', 'name': 'Steel Rebar Y16 (12m)',       'category': 'material',   'unit': 'Length', 'reorder_level': 50},
            {'item_code': 'MAT-003', 'name': 'Steel Rebar Y12 (12m)',       'category': 'material',   'unit': 'Length', 'reorder_level': 50},
            {'item_code': 'MAT-004', 'name': 'River Sand',                  'category': 'material',   'unit': 'Tonne',  'reorder_level': 20},
            {'item_code': 'MAT-005', 'name': 'Ballast (19mm)',              'category': 'material',   'unit': 'Tonne',  'reorder_level': 20},
            {'item_code': 'MAT-006', 'name': 'Hardcore',                    'category': 'material',   'unit': 'Tonne',  'reorder_level': 10},
            {'item_code': 'MAT-007', 'name': 'BRC Mesh A193',               'category': 'material',   'unit': 'Sheet',  'reorder_level': 20},
            {'item_code': 'MAT-008', 'name': 'Binding Wire',                'category': 'material',   'unit': 'Roll',   'reorder_level': 10},
            {'item_code': 'MAT-009', 'name': 'Timber (2x4 inch, 12ft)',     'category': 'material',   'unit': 'Piece',  'reorder_level': 30},
            {'item_code': 'MAT-010', 'name': 'Plywood (18mm)',              'category': 'material',   'unit': 'Sheet',  'reorder_level': 20},
            # Tools
            {'item_code': 'TOL-001', 'name': 'Wheel Barrow',               'category': 'tool',       'unit': 'Piece',  'reorder_level': 5},
            {'item_code': 'TOL-002', 'name': 'Shovel',                     'category': 'tool',       'unit': 'Piece',  'reorder_level': 10},
            {'item_code': 'TOL-003', 'name': 'Pickaxe',                    'category': 'tool',       'unit': 'Piece',  'reorder_level': 10},
            {'item_code': 'TOL-004', 'name': 'Tape Measure (50m)',         'category': 'tool',       'unit': 'Piece',  'reorder_level': 3},
            {'item_code': 'TOL-005', 'name': 'Spirit Level (1m)',          'category': 'tool',       'unit': 'Piece',  'reorder_level': 3},
            # PPE
            {'item_code': 'PPE-001', 'name': 'Safety Helmet',              'category': 'ppe',        'unit': 'Piece',  'reorder_level': 20},
            {'item_code': 'PPE-002', 'name': 'Safety Boots (pair)',        'category': 'ppe',        'unit': 'Pair',   'reorder_level': 10},
            {'item_code': 'PPE-003', 'name': 'Reflective Jacket',          'category': 'ppe',        'unit': 'Piece',  'reorder_level': 20},
            {'item_code': 'PPE-004', 'name': 'Safety Gloves (pair)',       'category': 'ppe',        'unit': 'Pair',   'reorder_level': 30},
            {'item_code': 'PPE-005', 'name': 'Safety Goggles',             'category': 'ppe',        'unit': 'Piece',  'reorder_level': 10},
            # Consumables
            {'item_code': 'CON-001', 'name': 'Diesel (litres)',            'category': 'consumable', 'unit': 'Litre',  'reorder_level': 200},
            {'item_code': 'CON-002', 'name': 'Petrol (litres)',            'category': 'consumable', 'unit': 'Litre',  'reorder_level': 100},
            {'item_code': 'CON-003', 'name': 'Engine Oil (20L)',           'category': 'consumable', 'unit': 'Drum',   'reorder_level': 5},
            {'item_code': 'CON-004', 'name': 'Grease (1kg)',               'category': 'consumable', 'unit': 'Tin',    'reorder_level': 10},
            # Office
            {'item_code': 'OFF-001', 'name': 'A4 Paper (ream)',            'category': 'office',     'unit': 'Ream',   'reorder_level': 10},
            {'item_code': 'OFF-002', 'name': 'Printer Ink Cartridge',      'category': 'office',     'unit': 'Piece',  'reorder_level': 2},
            {'item_code': 'OFF-003', 'name': 'Stapler',                    'category': 'office',     'unit': 'Piece',  'reorder_level': 2},
        ]

        created = 0
        for item in items:
            _, c = StockItem.objects.get_or_create(
                item_code=item['item_code'],
                defaults={**item, 'is_active': True, 'valuation_method': 'wac'}
            )
            if c:
                created += 1

        self.stdout.write(self.style.SUCCESS(f'  ✓ {created} stock items'))

    # ── CRM Clients ───────────────────────────────────────────────────────────

    def _seed_clients(self):
        from crm.models import Client
        self.stdout.write('  Seeding CRM clients...')

        clients = [
            {'company_name': 'Kenya National Highways Authority',       'contact_person': 'John Kamau',     'email': 'procurement@kenha.go.ke',    'phone': '+254 20 6900 100', 'address': 'Blue Shield Towers, Nairobi'},
            {'company_name': 'Kenya National Housing Corporation',      'contact_person': 'Mary Wanjiku',   'email': 'contracts@knhc.go.ke',       'phone': '+254 20 2710 680', 'address': 'Uchumi House, Nairobi'},
            {'company_name': 'Lake Victoria South Water Services',      'contact_person': 'Peter Odhiambo', 'email': 'info@lvswsb.go.ke',          'phone': '+254 57 2023 218', 'address': 'Kisumu'},
            {'company_name': 'Nairobi City County',                     'contact_person': 'Grace Muthoni',  'email': 'procurement@nairobi.go.ke',  'phone': '+254 20 2220 000', 'address': 'City Hall, Nairobi'},
            {'company_name': 'Kenya Power & Lighting Company',          'contact_person': 'David Mutua',    'email': 'contracts@kplc.co.ke',       'phone': '+254 20 3201 000', 'address': 'Stima Plaza, Nairobi'},
            {'company_name': 'National Construction Authority',         'contact_person': 'Susan Achieng',  'email': 'info@nca.go.ke',             'phone': '+254 20 2711 557', 'address': 'Nairobi'},
            {'company_name': 'Kenya Urban Roads Authority',             'contact_person': 'James Mwangi',   'email': 'procurement@kura.go.ke',     'phone': '+254 20 3576 000', 'address': 'Barabara Plaza, Nairobi'},
            {'company_name': 'Athi Water Works Development Agency',     'contact_person': 'Alice Njeri',    'email': 'info@athiwater.go.ke',       'phone': '+254 20 2720 927', 'address': 'Nairobi'},
        ]

        created = 0
        for c in clients:
            _, created_flag = Client.objects.get_or_create(
                email=c['email'],
                defaults={**c, 'is_active': True}
            )
            if created_flag:
                created += 1

        self.stdout.write(self.style.SUCCESS(f'  ✓ {created} clients'))
