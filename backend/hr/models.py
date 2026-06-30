import uuid
from datetime import date, time as dtime
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError


def _ref(prefix, model, field='reference'):
    year = date.today().year
    count = model.objects.filter(**{f'{field}__startswith': f'{prefix}-{year}-'}).count()
    return f'{prefix}-{year}-{str(count + 1).zfill(4)}'


# ── Job Grades ─────────────────────────────────────────────────────────────────

class JobGrade(models.Model):
    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name              = models.CharField(max_length=50, unique=True)  # G1, G2 …
    basic_salary_min  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    basic_salary_max  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    description       = models.TextField(blank=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


# ── Positions ──────────────────────────────────────────────────────────────────

class Position(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title      = models.CharField(max_length=255)
    department = models.ForeignKey('core.Department', on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name='positions')
    job_grade  = models.ForeignKey(JobGrade, on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name='positions')
    is_active  = models.BooleanField(default=True)

    class Meta:
        ordering = ['title']

    def __str__(self):
        return self.title


# ── Employee ───────────────────────────────────────────────────────────────────

class Employee(models.Model):
    class EmploymentType(models.TextChoices):
        STAFF  = 'staff',  'Staff (Permanent)'
        CASUAL = 'casual', 'Casual (Daily Worker)'

    class Gender(models.TextChoices):
        MALE   = 'male',   'Male'
        FEMALE = 'female', 'Female'
        OTHER  = 'other',  'Other'

    class MaritalStatus(models.TextChoices):
        SINGLE   = 'single',   'Single'
        MARRIED  = 'married',  'Married'
        DIVORCED = 'divorced', 'Divorced'
        WIDOWED  = 'widowed',  'Widowed'

    id                        = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee_number           = models.CharField(max_length=20, unique=True, blank=True)
    user                      = models.OneToOneField(settings.AUTH_USER_MODEL,
                                                     on_delete=models.SET_NULL,
                                                     null=True, blank=True,
                                                     related_name='employee_profile')
    employment_type           = models.CharField(max_length=10,
                                                  choices=EmploymentType.choices,
                                                  default=EmploymentType.STAFF)
    first_name                = models.CharField(max_length=150)
    last_name                 = models.CharField(max_length=150)
    middle_name               = models.CharField(max_length=150, blank=True)
    email                     = models.EmailField(blank=True)
    phone                     = models.CharField(max_length=30)
    alt_phone                 = models.CharField(max_length=30, blank=True)
    gender                    = models.CharField(max_length=10, choices=Gender.choices, default=Gender.MALE)
    date_of_birth             = models.DateField(null=True, blank=True)
    marital_status            = models.CharField(max_length=15, choices=MaritalStatus.choices,
                                                  default=MaritalStatus.SINGLE)
    national_id               = models.CharField(max_length=20, blank=True)
    kra_pin                   = models.CharField(max_length=20, blank=True)
    nssf_number               = models.CharField(max_length=30, blank=True)
    nhif_number               = models.CharField(max_length=30, blank=True)
    department                = models.ForeignKey('core.Department', on_delete=models.SET_NULL,
                                                   null=True, blank=True, related_name='employees')
    position                  = models.ForeignKey(Position, on_delete=models.SET_NULL,
                                                   null=True, blank=True, related_name='employees')
    branch                    = models.ForeignKey('core.Branch', on_delete=models.SET_NULL,
                                                   null=True, blank=True, related_name='employees')
    manager                   = models.ForeignKey('self', on_delete=models.SET_NULL,
                                                   null=True, blank=True, related_name='direct_reports')
    reports_to                = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                                   null=True, blank=True, related_name='subordinate_employees')
    work_location             = models.CharField(max_length=100, blank=True)
    date_hired                = models.DateField()
    contract_end_date         = models.DateField(null=True, blank=True)
    is_active                 = models.BooleanField(default=True)
    termination_date          = models.DateField(null=True, blank=True)
    termination_reason        = models.TextField(blank=True)
    basic_salary              = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    daily_rate                = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    house_allowance           = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    transport_allowance       = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    medical_allowance         = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_allowances          = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bank_name                 = models.CharField(max_length=100, blank=True)
    bank_account              = models.CharField(max_length=50, blank=True)
    bank_branch               = models.CharField(max_length=100, blank=True)
    emergency_contact_name    = models.CharField(max_length=150, blank=True)
    emergency_contact_phone   = models.CharField(max_length=30, blank=True)
    emergency_contact_relation = models.CharField(max_length=50, blank=True)

    # Next of Kin
    account_name              = models.CharField(max_length=150, blank=True)
    next_of_kin_name          = models.CharField(max_length=150, blank=True)
    next_of_kin_relation      = models.CharField(max_length=50, blank=True)
    next_of_kin_phone         = models.CharField(max_length=30, blank=True)
    next_of_kin_alt_phone     = models.CharField(max_length=30, blank=True)
    next_of_kin_id            = models.CharField(max_length=20, blank=True)

    # Emergency Contact 2
    emergency_contact2_name     = models.CharField(max_length=150, blank=True)
    emergency_contact2_phone    = models.CharField(max_length=30, blank=True)
    emergency_contact2_relation = models.CharField(max_length=50, blank=True)

    # Medical Information
    class BloodGroup(models.TextChoices):
        A_POS  = 'A+',  'A+'
        A_NEG  = 'A-',  'A-'
        B_POS  = 'B+',  'B+'
        B_NEG  = 'B-',  'B-'
        AB_POS = 'AB+', 'AB+'
        AB_NEG = 'AB-', 'AB-'
        O_POS  = 'O+',  'O+'
        O_NEG  = 'O-',  'O-'

    class Disability(models.TextChoices):
        NONE     = 'none',     'None'
        VISUAL   = 'visual',   'Visual'
        HEARING  = 'hearing',  'Hearing'
        PHYSICAL = 'physical', 'Physical'
        OTHER    = 'other',    'Other'

    blood_group                = models.CharField(max_length=5, blank=True, choices=BloodGroup.choices)
    allergies                  = models.TextField(blank=True)
    chronic_conditions         = models.TextField(blank=True)
    disability                 = models.CharField(max_length=20, blank=True, choices=Disability.choices, default='none')
    disability_details         = models.TextField(blank=True)
    medical_insurance          = models.BooleanField(default=False)
    medical_insurance_category = models.CharField(max_length=5, blank=True)
    medical_insurance_deduction = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    medical_declaration        = models.TextField(blank=True)

    photo                     = models.CharField(max_length=500, blank=True)
    notes                     = models.TextField(blank=True)
    created_at                = models.DateTimeField(auto_now_add=True)
    updated_at                = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['last_name', 'first_name']

    def clean(self):
        # Only validate on creation, not on updates (imported records may have future dates)
        if not self.pk and self.date_hired and self.date_hired > date.today():
            raise ValidationError({'date_hired': 'Date hired cannot be in the future.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        if not self.employee_number:
            prefix = 'EMP' if self.employment_type == 'staff' else 'CAS'
            count = Employee.objects.filter(
                employee_number__startswith=f'{prefix}-').count()
            self.employee_number = f'{prefix}-{str(count + 1).zfill(4)}'
        super().save(*args, **kwargs)

    @property
    def full_name(self):
        return f'{self.first_name} {self.last_name}'.strip()

    @property
    def gross_salary(self):
        return (self.basic_salary + self.house_allowance + self.transport_allowance
                + self.medical_allowance + self.other_allowances)

    def __str__(self):
        return f'{self.employee_number} — {self.full_name}'


class EmployeeDocument(models.Model):
    class DocType(models.TextChoices):
        CONTRACT    = 'contract',    'Employment Contract'
        ID_COPY     = 'id_copy',     'National ID Copy'
        CERTIFICATE = 'certificate', 'Certificate'
        NSSF_CARD   = 'nssf_card',   'NSSF Card'
        NHIF_CARD   = 'nhif_card',   'SHA/SHIF Card'
        KRA_CERT    = 'kra_cert',    'KRA Certificate'
        MEDICAL     = 'medical',     'Medical Certificate'
        CV          = 'cv',          'CV / Resume'
        GOOD_CONDUCT = 'good_conduct', 'Certificate of Good Conduct'
        ACADEMICS   = 'academics',   'Academic Certificates'
        OTHER       = 'other',       'Other'

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee    = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='documents')
    doc_type    = models.CharField(max_length=20, choices=DocType.choices)
    title       = models.CharField(max_length=255)
    file_ref    = models.CharField(max_length=500, blank=True)
    notes       = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                    null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.employee} — {self.title}'


# ── Biometric Devices ──────────────────────────────────────────────────────────

class BiometricDevice(models.Model):
    class DeviceType(models.TextChoices):
        FINGERPRINT = 'fingerprint', 'Fingerprint'
        FACE        = 'face',        'Face Recognition'
        CARD        = 'card',        'Card / RFID'
        HYBRID      = 'hybrid',      'Hybrid'

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    device_id   = models.CharField(max_length=100, unique=True)
    name        = models.CharField(max_length=255)
    location    = models.CharField(max_length=255)
    device_type = models.CharField(max_length=15, choices=DeviceType.choices,
                                   default=DeviceType.FINGERPRINT)
    ip_address  = models.CharField(max_length=50, blank=True)
    api_key     = models.CharField(max_length=128, blank=True)
    is_active   = models.BooleanField(default=True)
    last_sync   = models.DateTimeField(null=True, blank=True)
    notes       = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        if not self.api_key:
            import secrets
            self.api_key = secrets.token_hex(32)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.name} ({self.location})'


# ── Attendance ─────────────────────────────────────────────────────────────────

class AttendanceRecord(models.Model):
    class Source(models.TextChoices):
        BIOMETRIC = 'biometric', 'Biometric'
        MANUAL    = 'manual',    'Manual'
        MOBILE    = 'mobile',    'Mobile App'

    class Status(models.TextChoices):
        PRESENT        = 'present',        'Present'
        ABSENT         = 'absent',         'Absent'
        LATE           = 'late',           'Late'
        HALF_DAY       = 'half_day',       'Half Day'
        ON_LEAVE       = 'on_leave',       'On Leave'
        PUBLIC_HOLIDAY = 'public_holiday', 'Public Holiday'
        OFF            = 'off',            'Off Day'

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee         = models.ForeignKey(Employee, on_delete=models.CASCADE,
                                         related_name='attendance_records')
    date             = models.DateField()
    time_in          = models.TimeField(null=True, blank=True)
    time_out         = models.TimeField(null=True, blank=True)
    source           = models.CharField(max_length=15, choices=Source.choices,
                                        default=Source.MANUAL)
    device           = models.ForeignKey(BiometricDevice, on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='records')
    status           = models.CharField(max_length=20, choices=Status.choices,
                                        default=Status.ABSENT)
    late_minutes     = models.IntegerField(default=0)
    overtime_minutes = models.IntegerField(default=0)
    notes            = models.TextField(blank=True)
    recorded_by      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='attendance_recorded')
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['employee', 'date']
        ordering = ['-date', 'employee__last_name']

    def clean(self):
        if self.time_in and self.time_out and self.time_out < self.time_in:
            raise ValidationError({'time_out': 'time_out must be on or after time_in.'})
        # Prevent marking someone as Present (or Late) AND On Leave on the same day
        if self.status in (self.Status.PRESENT, self.Status.LATE):
            from .models import LeaveApplication
            overlapping = LeaveApplication.objects.filter(
                employee=self.employee,
                status='approved',
                start_date__lte=self.date,
                end_date__gte=self.date,
            ).exists()
            if overlapping:
                raise ValidationError(
                    f'Cannot mark employee as {self.status} on {self.date}: '
                    'an approved leave covers this date.'
                )

    def save(self, *args, **kwargs):
        self.clean()
        super().save(*args, **kwargs)

    def compute_status(self):
        if not self.time_in:
            self.status = self.Status.ABSENT
            return
        work_start = dtime(8, 15)
        work_end   = dtime(17, 0)
        if self.time_in > work_start:
            self.status = self.Status.LATE
            dt_in  = self.time_in.hour * 60 + self.time_in.minute
            dt_exp = work_start.hour * 60 + work_start.minute
            self.late_minutes = dt_in - dt_exp
        else:
            self.status = self.Status.PRESENT
        if self.time_out and self.time_out > work_end:
            dt_out = self.time_out.hour * 60 + self.time_out.minute
            dt_end = work_end.hour * 60 + work_end.minute
            self.overtime_minutes = dt_out - dt_end

    def __str__(self):
        return f'{self.employee} — {self.date} ({self.status})'


# ── Leave ──────────────────────────────────────────────────────────────────────

class LeaveType(models.Model):
    class ApplicableTo(models.TextChoices):
        ALL         = 'all',         'All Employees'
        STAFF_ONLY  = 'staff_only',  'Staff Only'
        CASUAL_ONLY = 'casual_only', 'Casual Only'

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name            = models.CharField(max_length=100)
    code            = models.CharField(max_length=10, unique=True)
    days_entitled   = models.DecimalField(max_digits=5, decimal_places=1, default=21)
    is_paid         = models.BooleanField(default=True)
    carry_forward   = models.BooleanField(default=False)
    max_carry_forward = models.IntegerField(default=0)
    applicable_to   = models.CharField(max_length=15, choices=ApplicableTo.choices,
                                        default=ApplicableTo.ALL)
    description     = models.TextField(blank=True)
    is_active       = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.code})'


class LeaveBalance(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee        = models.ForeignKey(Employee, on_delete=models.CASCADE,
                                        related_name='leave_balances')
    leave_type      = models.ForeignKey(LeaveType, on_delete=models.CASCADE)
    year            = models.IntegerField()
    entitled_days   = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    taken_days      = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    carried_forward = models.DecimalField(max_digits=5, decimal_places=1, default=0)

    class Meta:
        unique_together = ['employee', 'leave_type', 'year']

    @property
    def balance(self):
        return float(self.entitled_days) + float(self.carried_forward) - float(self.taken_days)

    def __str__(self):
        return f'{self.employee} — {self.leave_type} {self.year}'


class LeaveApplication(models.Model):
    class Status(models.TextChoices):
        DRAFT     = 'draft',     'Draft'
        SUBMITTED = 'submitted', 'Submitted'
        APPROVED  = 'approved',  'Approved'
        REJECTED  = 'rejected',  'Rejected'
        CANCELLED = 'cancelled', 'Cancelled'

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference   = models.CharField(max_length=20, unique=True, blank=True)
    employee    = models.ForeignKey(Employee, on_delete=models.CASCADE,
                                    related_name='leave_applications')
    leave_type  = models.ForeignKey(LeaveType, on_delete=models.PROTECT)
    start_date  = models.DateField()
    end_date    = models.DateField()
    days        = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    reason      = models.TextField()
    status      = models.CharField(max_length=15, choices=Status.choices, default=Status.DRAFT)
    handover_to = models.ForeignKey(Employee, on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='leave_handovers')
    reviewed_by   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                      null=True, blank=True, related_name='leave_reviews')
    reviewed_at   = models.DateTimeField(null=True, blank=True)
    review_notes  = models.TextField(blank=True)
    applied_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-applied_at']

    def clean(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError({'end_date': 'end_date must be on or after start_date.'})

    def save(self, *args, **kwargs):
        self.clean()
        if not self.reference:
            self.reference = _ref('LEV', LeaveApplication)
        if self.start_date and self.end_date:
            # Count weekdays
            d, total = self.start_date, 0
            while d <= self.end_date:
                if d.weekday() < 5:
                    total += 1
                from datetime import timedelta
                d += timedelta(days=1)
            self.days = total
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.reference} — {self.employee} ({self.leave_type})'


# ── Payroll ────────────────────────────────────────────────────────────────────

class PayrollPeriod(models.Model):
    class Status(models.TextChoices):
        DRAFT      = 'draft',      'Draft'
        PROCESSING = 'processing', 'Processing'
        APPROVED   = 'approved',   'Approved'
        PAID       = 'paid',       'Paid'
        CLOSED     = 'closed',     'Closed'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name         = models.CharField(max_length=50)
    month        = models.IntegerField()
    year         = models.IntegerField()
    status       = models.CharField(max_length=15, choices=Status.choices, default=Status.DRAFT)
    payment_date = models.DateField(null=True, blank=True)
    notes        = models.TextField(blank=True)
    created_by   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                     related_name='payroll_periods_created')
    approved_by  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='payroll_periods_approved')
    approved_at  = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['month', 'year']
        ordering = ['-year', '-month']

    def get_month_display(self):
        import calendar
        return calendar.month_name[self.month]

    def __str__(self):
        return self.name


class PayrollEntry(models.Model):
    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    period            = models.ForeignKey(PayrollPeriod, on_delete=models.CASCADE,
                                          related_name='entries')
    employee          = models.ForeignKey(Employee, on_delete=models.PROTECT,
                                          related_name='payroll_entries')
    project           = models.ForeignKey('projects.Project', on_delete=models.SET_NULL,
                                          null=True, blank=True, related_name='payroll_entries',
                                          help_text='Project this salary is charged to. Leave blank for HQ/overhead staff.')
    working_days      = models.DecimalField(max_digits=5, decimal_places=1, default=26)
    days_worked       = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    days_on_leave     = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    basic_salary      = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    house_allowance   = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    transport_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    medical_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_allowances  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    daily_rate        = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    gross_pay         = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    paye              = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    nssf_employee     = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    nhif_employee     = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    nssf_employer     = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    nhif_employer     = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    loan_deductions   = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    advance_deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_deductions  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_deductions  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_pay           = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes             = models.TextField(blank=True)

    class Meta:
        unique_together = ['period', 'employee']
        ordering = ['employee__last_name']

    # Kenya PAYE tax bands (Finance Act 2023/24) — monthly gross in KES
    @staticmethod
    def compute_paye(gross):
        gross = float(gross)
        tax = 0.0
        # Bands: (width_of_band, rate)
        bands = [(24000, 0.10), (8333, 0.25), (467667, 0.30), (300000, 0.325)]
        remaining = gross
        for limit, rate in bands:
            if remaining <= 0:
                break
            taxable = min(remaining, limit)
            tax += taxable * rate
            remaining -= taxable
        if remaining > 0:
            tax += remaining * 0.35
        return round(max(0.0, tax - 2400.0), 2)  # personal relief KES 2,400/month

    @staticmethod
    def compute_nssf(gross):
        """NSSF 2023 Act: 6% of gross salary, employee contribution capped at KES 2,160/month."""
        gross = float(gross)
        return round(min(gross * 0.06, 2160.0), 2)

    @staticmethod
    def compute_nhif(gross):
        """SHA/SHIF tiered bands (NHIF 2023 rates)."""
        gross = float(gross)
        bands = [
            (5999,   150.0),
            (7999,   300.0),
            (11999,  400.0),
            (14999,  500.0),
            (19999,  600.0),
            (24999,  750.0),
            (29999,  850.0),
            (34999,  900.0),
            (39999,  950.0),
            (44999, 1000.0),
            (49999, 1100.0),
            (59999, 1200.0),
            (69999, 1300.0),
            (79999, 1400.0),
            (89999, 1500.0),
            (99999, 1600.0),
        ]
        for ceiling, amount in bands:
            if gross <= ceiling:
                return amount
        return 1700.0

    def clean(self):
        if self.basic_salary is not None and self.basic_salary < 0:
            raise ValidationError({'basic_salary': 'basic_salary must be >= 0.'})

    def recalculate(self):
        self.gross_pay = (self.basic_salary + self.house_allowance +
                          self.transport_allowance + self.medical_allowance +
                          self.other_allowances)
        self.paye          = self.compute_paye(self.gross_pay)
        self.nssf_employee = self.compute_nssf(self.gross_pay)
        self.nhif_employee = self.compute_nhif(self.gross_pay)
        self.nssf_employer = self.nssf_employee
        self.nhif_employer = self.nhif_employee
        self.total_deductions = (self.paye + self.nssf_employee + self.nhif_employee
                                 + self.loan_deductions + self.advance_deductions
                                 + self.other_deductions)
        self.net_pay = self.gross_pay - self.total_deductions

    def save(self, *args, **kwargs):
        self.clean()
        self.recalculate()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.period} — {self.employee}'


class SalaryAdvance(models.Model):
    class Status(models.TextChoices):
        PENDING  = 'pending',  'Pending'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        DEDUCTED = 'deducted', 'Deducted'

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee         = models.ForeignKey(Employee, on_delete=models.CASCADE,
                                         related_name='salary_advances')
    amount           = models.DecimalField(max_digits=12, decimal_places=2)
    request_date     = models.DateField(auto_now_add=True)
    reason           = models.TextField()
    approved_by      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='advances_approved')
    approved_at      = models.DateTimeField(null=True, blank=True)
    deduction_period = models.ForeignKey(PayrollPeriod, on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='advances')
    status           = models.CharField(max_length=15, choices=Status.choices,
                                        default=Status.PENDING)
    notes            = models.TextField(blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.employee} — KES {self.amount} ({self.status})'


# ── Disciplinary ───────────────────────────────────────────────────────────────

class DisciplinaryRecord(models.Model):
    class RecordType(models.TextChoices):
        WARNING    = 'warning',    'Written Warning'
        SUSPENSION = 'suspension', 'Suspension'
        TERMINATION = 'termination', 'Termination'
        COUNSELLING = 'counselling', 'Counselling'
        OTHER      = 'other',      'Other'

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee       = models.ForeignKey(Employee, on_delete=models.CASCADE,
                                       related_name='disciplinary_records')
    incident_date  = models.DateField()
    record_type    = models.CharField(max_length=15, choices=RecordType.choices)
    description    = models.TextField()
    action_taken   = models.TextField()
    issued_by      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                       related_name='disciplinary_issued')
    acknowledged   = models.BooleanField(default=False)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    notes          = models.TextField(blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-incident_date']

    def __str__(self):
        return f'{self.employee} — {self.record_type} ({self.incident_date})'


# ── Employee Transfers ─────────────────────────────────────────────────────────

class EmployeeTransfer(models.Model):
    class TransferType(models.TextChoices):
        PERMANENT  = 'permanent',  'Permanent Transfer'
        TEMPORARY  = 'temporary',  'Temporary Transfer'

    class DestinationType(models.TextChoices):
        SITE        = 'site',        'Site / Field'
        HEAD_OFFICE = 'head_office', 'Head Office'
        BRANCH      = 'branch',      'Branch Office'

    class Status(models.TextChoices):
        DRAFT     = 'draft',     'Draft'
        SUBMITTED = 'submitted', 'Submitted'
        APPROVED  = 'approved',  'Approved'
        REJECTED  = 'rejected',  'Rejected'
        CANCELLED = 'cancelled', 'Cancelled'

    id                   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    employee             = models.ForeignKey(Employee, on_delete=models.CASCADE,
                                             related_name='transfers')
    transfer_type        = models.CharField(max_length=15, choices=TransferType.choices)
    destination_type     = models.CharField(max_length=15, choices=DestinationType.choices)
    from_location        = models.CharField(max_length=200)
    to_location          = models.CharField(max_length=200)
    project              = models.ForeignKey('projects.Project', on_delete=models.SET_NULL,
                                             null=True, blank=True, related_name='employee_transfers',
                                             help_text='Link to project site (for site transfers)')
    start_date           = models.DateField()
    end_date             = models.DateField(null=True, blank=True,
                                            help_text='Leave blank for permanent transfers')
    reason               = models.TextField()

    # Allowances (applicable when moving to site/field)
    relocation_allowance = models.DecimalField(max_digits=12, decimal_places=2,
                                               default=0, help_text='One-off relocation payment')
    daily_allowance      = models.DecimalField(max_digits=10, decimal_places=2,
                                               default=0, help_text='Daily allowance rate')
    daily_allowance_days = models.PositiveIntegerField(default=0,
                                                        help_text='Number of days for daily allowance')

    status               = models.CharField(max_length=15, choices=Status.choices,
                                            default=Status.DRAFT)
    requested_by         = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                             related_name='transfers_requested')
    reviewed_by          = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                             null=True, blank=True, related_name='transfers_reviewed')
    reviewed_at          = models.DateTimeField(null=True, blank=True)
    review_notes         = models.TextField(blank=True)
    created_at           = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.employee} → {self.to_location} ({self.transfer_type})'

    @property
    def total_allowance(self):
        return self.relocation_allowance + (self.daily_allowance * self.daily_allowance_days)


# ── Casuals Register ────────────────────────────────────────────────────────────

class Casual(models.Model):
    class Status(models.TextChoices):
        PENDING          = 'pending',          'Pending'
        FOREMAN_APPROVED = 'foreman_approved', 'Foreman Approved'
        HR_APPROVED      = 'hr_approved',      'HR Approved'
        PAID             = 'paid',             'Paid'
        CANCELLED        = 'cancelled',        'Cancelled'

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    id_number   = models.CharField(max_length=20, unique=True, db_index=True,
                                   help_text='National ID — used to identify returning casuals')
    full_name   = models.CharField(max_length=200, help_text='Full name as it appears on ID')
    phone       = models.CharField(max_length=20, help_text='Phone for mobile money payment')
    placement   = models.CharField(max_length=200, help_text='Head Office or project site location')
    assignment  = models.TextField(help_text='Work assigned to the casual')
    daily_rate  = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status      = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)

    foreman_approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='casuals_foreman_approved'
    )
    foreman_approved_at = models.DateTimeField(null=True, blank=True)
    hr_approved_by      = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='casuals_hr_approved'
    )
    hr_approved_at      = models.DateTimeField(null=True, blank=True)
    notes               = models.TextField(blank=True)

    created_by  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                    related_name='casuals_created')
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.full_name} ({self.id_number})'


class CasualDailyLog(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    casual      = models.ForeignKey(Casual, on_delete=models.CASCADE, related_name='daily_logs')
    work_date   = models.DateField()
    days_worked = models.DecimalField(max_digits=4, decimal_places=2, default=1,
                                      help_text='1 = full day, 0.5 = half day')
    notes       = models.TextField(blank=True)
    logged_by   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                    related_name='casual_logs_created')
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering  = ['-work_date']
        unique_together = [['casual', 'work_date']]

    def __str__(self):
        return f'{self.casual.full_name} – {self.work_date} ({self.days_worked}d)'
