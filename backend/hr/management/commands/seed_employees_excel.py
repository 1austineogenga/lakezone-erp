"""
Seed employees from HR_EMS_Final.xlsx.
Usage: python manage.py seed_employees_excel --file /path/to/HR_EMS_Final.xlsx
"""
import openpyxl
from datetime import datetime, date
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from core.models import Department, Branch
from hr.models import Employee, Position


def _parse_date(val):
    if not val:
        return None
    if isinstance(val, (date, datetime)):
        return val.date() if isinstance(val, datetime) else val
    s = str(val).strip()
    for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%m/%d/%Y', '%d-%m-%Y'):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


def _str(val):
    if val is None:
        return ''
    return str(val).strip()


EMPLOYMENT_TYPE_MAP = {
    'fixed term': 'staff',
    'permanent': 'staff',
    'staff': 'staff',
    'casual': 'casual',
}

GENDER_MAP = {
    'male': 'male',
    'm': 'male',
    'female': 'female',
    'f': 'female',
}

MARITAL_MAP = {
    'single': 'single',
    'married': 'married',
    'divorced': 'divorced',
    'widowed': 'widowed',
}


class Command(BaseCommand):
    help = 'Seed employee data from HR_EMS_Final.xlsx'

    def add_arguments(self, parser):
        parser.add_argument(
            '--file',
            default='/root/.claude/uploads/e1b9f1ea-5b0e-545a-86a9-059994014d7e/7ebdb3ef-HR_EMS_Final.xlsx',
            help='Path to the Excel file',
        )
        parser.add_argument('--dry-run', action='store_true', help='Print what would be created without saving')

    def handle(self, *args, **options):
        path = options['file']
        dry_run = options['dry_run']

        try:
            wb = openpyxl.load_workbook(path)
        except FileNotFoundError:
            raise CommandError(f'File not found: {path}')

        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        headers = [str(h).strip() if h else '' for h in rows[0]]

        # Column index map
        def col(name):
            try:
                return headers.index(name)
            except ValueError:
                return None

        idx = {
            'employee_id':    col('Employee ID'),
            'first_name':     col('First Name'),
            'surname':        col('Surname'),
            'last_name':      col('Last Name'),
            'phone':          col('Phone Number'),
            'job_title':      col('Job Title'),
            'department':     col('Department'),
            'emp_type':       col('Employment Type'),
            'reports_to':     col('Reports To'),
            'date_hired':     col('Date of Employment'),
            'emp_status':     col('Employment Status'),
            'work_location':  col('Work Location'),
            'dob':            col('Date of Birth'),
            'gender':         col('Gender'),
            'marital':        col('Marital Status'),
            'national_id':    col('National ID'),
            'kra_pin':        col('KRA PIN'),
            'sha':            col('SHA'),
            'nssf':           col('NSSF'),
            'nok_name':       col('Next of Kin Name'),
            'nok_rel':        col('Relationship'),
            'nok_phone':      col('Next of Kin Phone'),
            'ec1_name':       col('Emergency Contact 1 Name'),
            'ec1_phone':      col('Emergency Contact 1 Phone'),
            'ec1_rel':        col('Emergency Contact 1 Relationship'),
            'ec2_name':       col('Emergency Contact 2 Name'),
            'ec2_phone':      col('Emergency Contact 2 Phone'),
        }

        # Pre-load lookup caches
        dept_cache = {d.name.lower(): d for d in Department.objects.all()}
        pos_cache  = {p.title.lower(): p for p in Position.objects.all()}
        branch_cache = {b.name.lower(): b for b in Branch.objects.all()}

        created = 0
        skipped = 0
        errors = []

        def get(row, key):
            i = idx.get(key)
            return _str(row[i]) if i is not None and i < len(row) else ''

        with transaction.atomic():
            for row_num, row in enumerate(rows[1:], start=2):
                emp_number = get(row, 'employee_id')
                first_name = get(row, 'first_name')
                middle_name = get(row, 'surname')
                last_name = get(row, 'last_name')

                if not first_name and not last_name:
                    self.stdout.write(f'  Row {row_num}: empty name — skipping')
                    skipped += 1
                    continue

                # Skip if employee_number already exists
                if emp_number and Employee.objects.filter(employee_number=emp_number).exists():
                    self.stdout.write(f'  Row {row_num}: {emp_number} already exists — skipping')
                    skipped += 1
                    continue

                dept_name = get(row, 'department')
                department = dept_cache.get(dept_name.lower()) if dept_name else None

                job_title = get(row, 'job_title')
                position = pos_cache.get(job_title.lower()) if job_title else None

                emp_type_raw = get(row, 'emp_type').lower()
                employment_type = EMPLOYMENT_TYPE_MAP.get(emp_type_raw, 'staff')

                gender_raw = get(row, 'gender').lower()
                gender = GENDER_MAP.get(gender_raw, 'male')

                marital_raw = get(row, 'marital').lower()
                marital_status = MARITAL_MAP.get(marital_raw, 'single')

                date_hired = _parse_date(get(row, 'date_hired'))
                if not date_hired:
                    date_hired = date.today()

                phone = get(row, 'phone')
                if phone and not phone.startswith('+'):
                    phone = phone  # store as-is

                emp_status = get(row, 'emp_status')
                is_active = emp_status.lower() not in ('inactive', 'terminated', 'resigned') if emp_status else True

                if dry_run:
                    self.stdout.write(
                        f'  [DRY RUN] Would create: {emp_number} {first_name} {last_name} '
                        f'({dept_name} / {job_title})'
                    )
                    created += 1
                    continue

                emp = Employee(
                    employee_number=emp_number,
                    first_name=first_name,
                    middle_name=middle_name,
                    last_name=last_name,
                    phone=phone or '000',
                    gender=gender,
                    marital_status=marital_status,
                    date_of_birth=_parse_date(get(row, 'dob')),
                    date_hired=date_hired,
                    employment_type=employment_type,
                    department=department,
                    position=position,
                    national_id=get(row, 'national_id'),
                    kra_pin=get(row, 'kra_pin'),
                    nssf_number=get(row, 'nssf'),
                    nhif_number=get(row, 'sha'),
                    work_location=get(row, 'work_location'),
                    is_active=is_active,
                    next_of_kin_name=get(row, 'nok_name'),
                    next_of_kin_relation=get(row, 'nok_rel'),
                    next_of_kin_phone=get(row, 'nok_phone'),
                    emergency_contact_name=get(row, 'ec1_name'),
                    emergency_contact_phone=get(row, 'ec1_phone'),
                    emergency_contact_relation=get(row, 'ec1_rel'),
                    emergency_contact2_name=get(row, 'ec2_name'),
                    emergency_contact2_phone=get(row, 'ec2_phone'),
                )
                emp.save()
                created += 1
                self.stdout.write(f'  Created: {emp_number} {first_name} {last_name}')

        self.stdout.write(self.style.SUCCESS(
            f'\nDone. Created: {created}, Skipped: {skipped}'
        ))
        if errors:
            for e in errors:
                self.stdout.write(self.style.ERROR(f'  ERROR: {e}'))
