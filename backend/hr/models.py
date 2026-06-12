import uuid
from datetime import date, time as dtime
from django.db import models
from django.conf import settings


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
    photo                     = models.CharField(max_length=500, blank=True)
    notes                     = models.TextField(blank=True)
    created_at                = models.DateTimeField(auto_now_add=True)
    updated_at                = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['last_name', 'first_name']

    def save(self, *args, **kwargs):
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
        CONTRACT  = 'contract',  'Employment Contract'
        ID_COPY   = 'id_copy',   'ID Copy'
        CERTIFICATE = 'certificate', 'Certificate'
        NSSF_CARD = 'nssf_card', 'NSSF Card'
        NHIF_CARD = 'nhif_card', 'NHIF / SHIF Card'
        KRA_CERT  = 'kra_cert',  'KRA Certificate'
        MEDICAL   = 'medical',   'Medical Certificate'
        OTHER     = 'other',     'Other'

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

    def save(self, *args, **kwargs):
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
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['month', 'year']
        ordering = ['-year', '-month']

    def __str__(self):
        return self.name


class PayrollEntry(models.Model):
    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    period            = models.ForeignKey(PayrollPeriod, on_delete=models.CASCADE,
                                          related_name='entries')
    employee          = models.ForeignKey(Employee, on_delete=models.PROTECT,
                                          related_name='payroll_entries')
    working_days      = models.DecimalField(max_digits=5, decimal_places=1, default=26)
    days_worked       = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    days_on_leave     = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    basic_salary      = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    house_allowance   = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    transport_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    medical_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_allowances  = models.DecimalField(max_digits=12, decimal_places=2, default=0)
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

    @staticmethod
    def compute_paye(gross):
        gross = float(gross)
        tax = 0
        bands = [(24000, 0.10), (8333, 0.25), (467667, 0.30), (300000, 0.325)]
        for limit, rate in bands:
            if gross <= 0:
                break
            taxable = min(gross, limit)
            tax += taxable * rate
            gross -= taxable
        if gross > 0:
            tax += gross * 0.35
        return max(0, tax - 2400)  # personal relief

    @staticmethod
    def compute_nssf(gross):
        gross = float(gross)
        tier1_ceiling = 7000
        tier2_ceiling = 36000
        rate = 0.06
        tier1 = min(gross, tier1_ceiling) * rate
        tier2 = max(0, min(gross, tier1_ceiling + tier2_ceiling) - tier1_ceiling) * rate
        return round(tier1 + tier2, 2)

    @staticmethod
    def compute_nhif(gross):
        return round(float(gross) * 0.0275, 2)

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
