import uuid
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
