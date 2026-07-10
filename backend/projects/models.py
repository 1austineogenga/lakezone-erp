import uuid
from django.conf import settings
from django.db import models


class Project(models.Model):
    STATUS_CHOICES = [
        ('planning', 'Planning'),
        ('active', 'Active'),
        ('on_hold', 'On Hold'),
        ('completed', 'Completed'),
        ('suspended', 'Suspended'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=200)
    client = models.CharField(max_length=200, blank=True)
    contract_number = models.CharField(max_length=100, blank=True)
    contract_value = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    location = models.CharField(max_length=200, blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    description = models.TextField(blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planning')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.code} - {self.name}"


class BOQ(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='boqs')
    title = models.CharField(max_length=200)
    notes = models.TextField(blank=True)
    contingency_pct = models.DecimalField(max_digits=5, decimal_places=2, default=10.00)
    vop_pct = models.DecimalField(max_digits=5, decimal_places=2, default=10.00)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.project.code} BOQ: {self.title}"


class BOQBill(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    boq = models.ForeignKey(BOQ, on_delete=models.CASCADE, related_name='bills')
    bill_number = models.CharField(max_length=20)
    description = models.CharField(max_length=500, blank=True)
    sub_total = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order', 'bill_number']

    def __str__(self):
        return f"Bill {self.bill_number}: {self.description}"


class BOQItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bill = models.ForeignKey(BOQBill, on_delete=models.CASCADE, related_name='items')
    item_number = models.CharField(max_length=20)
    description = models.TextField()
    unit = models.CharField(max_length=50, blank=True)
    quantity = models.DecimalField(max_digits=15, decimal_places=3, default=0)
    rate = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    actual_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['item_number']

    def __str__(self):
        return f"{self.item_number} - {self.description[:50]}"


class Budget(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_approval', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('locked', 'Locked'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name='budgets')
    title = models.CharField(max_length=200)
    period_weeks = models.PositiveIntegerField(default=8)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    notes = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.project.code} Budget: {self.title}"


class BudgetRate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    budget = models.ForeignKey(Budget, on_delete=models.CASCADE, related_name='rates')
    name = models.CharField(max_length=200)
    value = models.DecimalField(max_digits=15, decimal_places=4, default=0)
    unit = models.CharField(max_length=50, blank=True)
    used_in = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.name}: {self.value} {self.unit}"


class BudgetLineItem(models.Model):
    CATEGORY_CHOICES = [
        ('materials', 'Materials'),
        ('fuel', 'Fuel'),
        ('labour', 'Labour'),
        ('casuals', 'Casuals'),
        ('management', 'Management'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    budget = models.ForeignKey(Budget, on_delete=models.CASCADE, related_name='line_items')
    boq_item = models.ForeignKey(BOQItem, null=True, blank=True, on_delete=models.SET_NULL, related_name='budget_lines')
    week_no = models.PositiveIntegerField(null=True, blank=True)
    month_no = models.PositiveIntegerField(null=True, blank=True)
    work_focus = models.CharField(max_length=200, blank=True)
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    description = models.CharField(max_length=500)
    quantity = models.DecimalField(max_digits=15, decimal_places=3, default=0)
    unit = models.CharField(max_length=50, blank=True)
    base_rate = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    waste_allowance_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    low_variance_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    high_variance_pct = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    base_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    low_case_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    high_case_cost = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    variance_reserve = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    remarks = models.TextField(blank=True)

    class Meta:
        ordering = ['week_no', 'month_no', 'category']

    def __str__(self):
        return f"W{self.week_no} {self.category}: {self.description[:50]}"


class IPC(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('submitted', 'Submitted'),
        ('certified', 'Certified'),
        ('approved', 'Approved'),
        ('paid', 'Paid'),
        ('rejected', 'Rejected'),
        ('disputed', 'Disputed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.PROTECT, related_name='ipcs')
    ipc_number = models.PositiveIntegerField()
    period_from = models.DateField()
    period_to = models.DateField()
    chainage_from = models.CharField(max_length=20, blank=True)
    chainage_to = models.CharField(max_length=20, blank=True)
    amount_claimed = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    amount_certified = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    amount_paid = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    submission_date = models.DateField(null=True, blank=True)
    certification_date = models.DateField(null=True, blank=True)
    payment_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    notes = models.TextField(blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('project', 'ipc_number')]
        ordering = ['project', 'ipc_number']

    def __str__(self):
        return f"{self.project.code} IPC #{self.ipc_number}"


class IPCItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ipc = models.ForeignKey(IPC, on_delete=models.CASCADE, related_name='items')
    boq_item = models.ForeignKey(BOQItem, null=True, blank=True, on_delete=models.SET_NULL, related_name='ipc_items')
    description = models.CharField(max_length=500)
    unit = models.CharField(max_length=50, blank=True)
    quantity_this_ipc = models.DecimalField(max_digits=15, decimal_places=3, default=0)
    quantity_to_date = models.DecimalField(max_digits=15, decimal_places=3, default=0)
    rate = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    def __str__(self):
        return f"IPC {self.ipc.ipc_number} item: {self.description[:50]}"


class ProjectRisk(models.Model):
    IMPACT_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    ]
    STATUS_CHOICES = [
        ('open', 'Open'),
        ('mitigated', 'Mitigated'),
        ('closed', 'Closed'),
        ('escalated', 'Escalated'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='risks')
    risk_description = models.TextField()
    expected_impact = models.TextField(blank=True)
    budget_treatment = models.TextField(blank=True)
    realistic_range = models.CharField(max_length=200, blank=True)
    owner = models.CharField(max_length=100, blank=True)
    impact_level = models.CharField(max_length=20, choices=IMPACT_CHOICES, default='medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.project.code} Risk: {str(self.risk_description)[:50]}"


class ProjectVehicle(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='assigned_vehicles')
    vehicle = models.ForeignKey('fleet.Vehicle', on_delete=models.CASCADE, related_name='project_assignments')
    assigned_from = models.DateField()
    assigned_to = models.DateField(null=True, blank=True)
    daily_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes = models.CharField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.vehicle} → {self.project.code}"


class ProjectPersonnel(models.Model):
    ROLE_CHOICES = [
        ('site_engineer', 'Site Engineer'),
        ('general_foreman', 'General Foreman'),
        ('surveyor', 'Surveyor'),
        ('foreman', 'Foreman'),
        ('hse_lead', 'HSE Lead'),
        ('clerk', 'Clerk'),
        ('operator', 'Operator'),
        ('casual', 'Casual'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='personnel')
    employee_name = models.CharField(max_length=200)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    monthly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    include_in_budget = models.BooleanField(default=True)
    notes = models.CharField(max_length=500, blank=True)

    def __str__(self):
        return f"{self.employee_name} ({self.role}) @ {self.project.code}"


class WeeklyProgress(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='weekly_progress')
    week_no = models.PositiveIntegerField()
    week_start = models.DateField()
    week_end = models.DateField()
    work_focus = models.TextField(blank=True)
    materials_actual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    fuel_actual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    labour_actual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    casuals_actual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_actual = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    casual_headcount = models.PositiveIntegerField(default=0)
    casual_person_days = models.PositiveIntegerField(default=0)
    progress_notes = models.TextField(blank=True)
    issues = models.TextField(blank=True)
    next_week_plan = models.TextField(blank=True)
    submitted_by = models.CharField(max_length=100, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [('project', 'week_no')]
        ordering = ['project', 'week_no']

    def __str__(self):
        return f"{self.project.code} Week {self.week_no}"


class ProjectPhase(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='phases')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    order = models.PositiveIntegerField(default=0)
    planned_start = models.DateField(null=True, blank=True)
    planned_end = models.DateField(null=True, blank=True)
    color = models.CharField(max_length=20, default='blue')

    class Meta:
        ordering = ['order', 'name']

    def __str__(self):
        return f"{self.project.code} — {self.name}"

    @property
    def percent_complete(self):
        activities = self.activities.all()
        if not activities.exists():
            return 0
        total_weight = sum(float(a.weight) for a in activities)
        if total_weight == 0:
            return 0
        weighted = sum(float(a.weight) * float(a.percent_complete) for a in activities)
        return round(weighted / total_weight, 1)


class ProjectActivity(models.Model):
    STATUS_CHOICES = [
        ('not_started', 'Not Started'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('on_hold', 'On Hold'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    phase = models.ForeignKey(ProjectPhase, on_delete=models.CASCADE, related_name='activities')
    wbs_code = models.CharField(max_length=50, blank=True, default='')
    description = models.CharField(max_length=500)
    planned_start = models.DateField(null=True, blank=True)
    planned_end = models.DateField(null=True, blank=True)
    actual_start = models.DateField(null=True, blank=True)
    actual_end = models.DateField(null=True, blank=True)
    percent_complete = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    weight = models.DecimalField(max_digits=5, decimal_places=2, default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='not_started')
    responsible = models.CharField(max_length=200, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'wbs_code', 'description']

    def __str__(self):
        return f"{self.wbs_code} {self.description}" if self.wbs_code else self.description


class ActivityProgress(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    activity = models.ForeignKey(ProjectActivity, on_delete=models.CASCADE, related_name='progress_entries')
    date = models.DateField()
    percent_complete = models.DecimalField(max_digits=5, decimal_places=1)
    notes = models.TextField(blank=True, default='')
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='activity_progress'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.activity} @ {self.percent_complete}% on {self.date}"


class VariationOrder(models.Model):
    VO_TYPE_CHOICES = [
        ('addition',       'Addition'),
        ('omission',       'Omission'),
        ('substitution',   'Substitution'),
        ('time_extension', 'Time Extension'),
    ]
    STATUS_CHOICES = [
        ('draft',       'Draft'),
        ('submitted',   'Submitted'),
        ('approved',    'Approved'),
        ('rejected',    'Rejected'),
        ('implemented', 'Implemented'),
    ]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project     = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='variation_orders')
    vo_number   = models.CharField(max_length=20, editable=False, blank=True)
    title       = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    vo_type     = models.CharField(max_length=20, choices=VO_TYPE_CHOICES, default='addition')
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    amount      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    submitted_date = models.DateField(null=True, blank=True)
    approved_date  = models.DateField(null=True, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True,
                                    on_delete=models.SET_NULL, related_name='approved_vos')
    created_by  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                    related_name='created_vos')
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.vo_number:
            from django.db import transaction
            from django.utils import timezone as tz
            with transaction.atomic():
                year = tz.now().year
                prefix = f'VO-{year}'
                count = VariationOrder.objects.select_for_update().filter(
                    project=self.project, vo_number__startswith=prefix
                ).count()
                self.vo_number = f'{prefix}-{str(count + 1).zfill(3)}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.vo_number} — {self.title}'


# ── New Phase-2 models ─────────────────────────────────────────────────────────

class ChainageSegment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='chainage_segments')
    name = models.CharField(max_length=100, help_text="e.g. Section 1")
    start_station_m = models.DecimalField(max_digits=10, decimal_places=2)
    end_station_m   = models.DecimalField(max_digits=10, decimal_places=2)

    class Meta:
        ordering = ['project', 'start_station_m']

    def __str__(self):
        return f"{self.project.code}: {self.name} ({self.start_station_m}m–{self.end_station_m}m)"


class SiteDiary(models.Model):
    class Weather(models.TextChoices):
        CLEAR       = 'clear',       'Clear'
        OVERCAST    = 'overcast',    'Overcast'
        LIGHT_RAIN  = 'light_rain',  'Light Rain'
        HEAVY_RAIN  = 'heavy_rain',  'Heavy Rain (non-working)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project          = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='site_diaries')
    date             = models.DateField()
    weather_am       = models.CharField(max_length=20, choices=Weather.choices, default=Weather.CLEAR)
    weather_pm       = models.CharField(max_length=20, choices=Weather.choices, default=Weather.CLEAR)
    is_weather_day_lost = models.BooleanField(default=False)
    labour_count     = models.PositiveIntegerField(default=0)
    work_summary     = models.TextField()
    plant_summary    = models.TextField(blank=True)
    delays           = models.TextField(blank=True)
    prepared_by      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='site_diaries')
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('project', 'date')]
        ordering = ['-date']

    def __str__(self):
        return f"{self.project.code} diary — {self.date}"


class QATestRecord(models.Model):
    class Result(models.TextChoices):
        PASS    = 'pass',    'Pass'
        FAIL    = 'fail',    'Fail'
        PENDING = 'pending', 'Pending'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project          = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='qa_tests')
    chainage_segment = models.ForeignKey(ChainageSegment, on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='qa_tests')
    test_type        = models.CharField(max_length=100, help_text="e.g. Compaction, CBR, Asphalt Mix")
    test_date        = models.DateField()
    station_m        = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    result_value     = models.CharField(max_length=100, blank=True)
    result           = models.CharField(max_length=10, choices=Result.choices, default=Result.PENDING)
    lab_reference    = models.CharField(max_length=100, blank=True)
    tested_by        = models.CharField(max_length=255, blank=True)
    remarks          = models.TextField(blank=True)
    attachment       = models.FileField(upload_to='qa_reports/%Y/%m/', null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-test_date']

    def __str__(self):
        return f"{self.test_type} @ {self.station_m}m — {self.result}"


class NonConformance(models.Model):
    class Status(models.TextChoices):
        OPEN        = 'open',        'Open'
        IN_PROGRESS = 'in_progress', 'In Progress'
        CLOSED      = 'closed',      'Closed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project          = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='non_conformances')
    chainage_segment = models.ForeignKey(ChainageSegment, on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='non_conformances')
    ncr_number       = models.CharField(max_length=30, blank=True)
    raised_date      = models.DateField()
    description      = models.TextField()
    root_cause       = models.TextField(blank=True)
    corrective_action = models.TextField(blank=True)
    status           = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    closed_date      = models.DateField(null=True, blank=True)
    raised_by        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                          null=True, blank=True, related_name='ncrs_raised')
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-raised_date']

    def save(self, *args, **kwargs):
        if not self.ncr_number:
            from django.utils import timezone as tz
            year = tz.now().year
            count = NonConformance.objects.filter(project=self.project,
                                                   ncr_number__startswith=f'NCR-{year}').count()
            self.ncr_number = f'NCR-{year}-{str(count + 1).zfill(3)}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.ncr_number}: {self.description[:50]}"


class RFIRecord(models.Model):
    class Status(models.TextChoices):
        OPEN     = 'open',     'Open'
        ANSWERED = 'answered', 'Answered'
        CLOSED   = 'closed',   'Closed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project        = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='rfi_records')
    reference_no   = models.CharField(max_length=30, blank=True)
    query          = models.TextField()
    raised_by      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                        null=True, blank=True, related_name='rfis_raised')
    raised_date    = models.DateField()
    response       = models.TextField(blank=True)
    responded_date = models.DateField(null=True, blank=True)
    drawing_reference = models.CharField(max_length=100, blank=True)
    status         = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-raised_date']

    def save(self, *args, **kwargs):
        if not self.reference_no:
            from django.utils import timezone as tz
            year = tz.now().year
            count = RFIRecord.objects.filter(project=self.project,
                                              reference_no__startswith=f'RFI-{year}').count()
            self.reference_no = f'RFI-{year}-{str(count + 1).zfill(3)}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.reference_no} — {self.status}"


class IncidentReport(models.Model):
    class Severity(models.TextChoices):
        NEAR_MISS = 'near_miss', 'Near Miss'
        MINOR     = 'minor',     'Minor'
        MAJOR     = 'major',     'Major'
        FATALITY  = 'fatality',  'Fatality'

    class Status(models.TextChoices):
        OPEN         = 'open',         'Open'
        INVESTIGATING = 'investigating', 'Under Investigation'
        CLOSED       = 'closed',       'Closed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project            = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='incidents')
    date               = models.DateField()
    severity           = models.CharField(max_length=20, choices=Severity.choices)
    description        = models.TextField()
    corrective_action  = models.TextField(blank=True)
    reported_by        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                            null=True, blank=True, related_name='incidents_reported')
    status             = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    signed_off_by      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                            null=True, blank=True, related_name='incidents_signed_off')
    signed_off_date    = models.DateField(null=True, blank=True)
    created_at         = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"Incident {self.date} — {self.severity}"


class Subcontractor(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project        = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='subcontractors')
    name           = models.CharField(max_length=255)
    scope_of_work  = models.TextField()
    contract_value = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    contact_person = models.CharField(max_length=255, blank=True)
    contact_phone  = models.CharField(max_length=30, blank=True)
    start_date     = models.DateField(null=True, blank=True)
    end_date       = models.DateField(null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.project.code})"


class SubcontractorMilestone(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        DUE     = 'due',     'Due'
        PAID    = 'paid',    'Paid'

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subcontractor  = models.ForeignKey(Subcontractor, on_delete=models.CASCADE, related_name='milestones')
    description    = models.CharField(max_length=255)
    amount         = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    due_date       = models.DateField(null=True, blank=True)
    status         = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)

    class Meta:
        ordering = ['due_date']

    def __str__(self):
        return f"{self.subcontractor.name}: {self.description}"
