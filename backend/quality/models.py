import uuid
from django.conf import settings
from django.db import models


class QualityInspection(models.Model):
    RESULT_CHOICES = [
        ('pass',         'Pass'),
        ('fail',         'Fail'),
        ('conditional',  'Conditional Pass'),
        ('pending',      'Pending'),
    ]
    CATEGORY_CHOICES = [
        ('earthworks',    'Earthworks'),
        ('concrete',      'Concrete'),
        ('structural',    'Structural'),
        ('finishing',     'Finishing'),
        ('electrical',    'Electrical'),
        ('plumbing',      'Plumbing'),
        ('road',          'Road Works'),
        ('drainage',      'Drainage'),
        ('general',       'General'),
        ('other',         'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_name = models.CharField(max_length=200, blank=True, default='')
    project_id = models.UUIDField(null=True, blank=True, db_index=True)
    inspection_date = models.DateField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='general')
    activity_description = models.CharField(max_length=300)
    location = models.CharField(max_length=300, blank=True, default='')
    inspector_name = models.CharField(max_length=200)
    result = models.CharField(max_length=15, choices=RESULT_CHOICES, default='pending')
    checklist_items = models.JSONField(default=list)  # [{item, result: pass/fail/na, remarks}]
    observations = models.TextField(blank=True, default='')
    corrective_action = models.TextField(blank=True, default='')
    re_inspection_date = models.DateField(null=True, blank=True)
    re_inspection_result = models.CharField(max_length=15, blank=True, default='')
    approved_by = models.CharField(max_length=200, blank=True, default='')
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='quality_inspections'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-inspection_date', '-created_at']

    def __str__(self):
        return f"{self.activity_description} — {self.inspection_date} — {self.result}"


class NCR(models.Model):
    """Non-Conformance Report"""
    SEVERITY_CHOICES = [
        ('minor',    'Minor'),
        ('major',    'Major'),
        ('critical', 'Critical'),
    ]
    STATUS_CHOICES = [
        ('open',       'Open'),
        ('in_review',  'In Review'),
        ('closed',     'Closed'),
        ('voided',     'Voided'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_name = models.CharField(max_length=200, blank=True, default='')
    project_id = models.UUIDField(null=True, blank=True, db_index=True)
    ncr_number = models.CharField(max_length=50, blank=True, default='')
    inspection = models.ForeignKey(
        QualityInspection, on_delete=models.SET_NULL, null=True, blank=True, related_name='ncrs'
    )
    date_raised = models.DateField()
    location = models.CharField(max_length=300, blank=True, default='')
    description = models.TextField()
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='minor')
    root_cause = models.TextField(blank=True, default='')
    corrective_action = models.TextField(blank=True, default='')
    action_due = models.DateField(null=True, blank=True)
    action_completed = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='open')
    raised_by = models.CharField(max_length=200, blank=True, default='')
    closed_by = models.CharField(max_length=200, blank=True, default='')
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='ncrs'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date_raised', '-created_at']

    def __str__(self):
        return f"NCR {self.ncr_number or self.id} — {self.status}"

    @property
    def is_overdue(self):
        from django.utils import timezone
        if self.status in ('closed', 'voided'):
            return False
        return bool(self.action_due and self.action_due < timezone.now().date())


class MaterialTest(models.Model):
    TEST_TYPE_CHOICES = [
        ('concrete_cube',   'Concrete Cube Test'),
        ('compaction',      'Compaction Test'),
        ('soil_cbr',        'Soil CBR'),
        ('aggregate',       'Aggregate Test'),
        ('asphalt',         'Asphalt Test'),
        ('water',           'Water Quality'),
        ('steel',           'Steel Test'),
        ('other',           'Other'),
    ]
    RESULT_CHOICES = [
        ('pass',   'Pass'),
        ('fail',   'Fail'),
        ('pending','Pending'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_name = models.CharField(max_length=200, blank=True, default='')
    project_id = models.UUIDField(null=True, blank=True, db_index=True)
    test_type = models.CharField(max_length=20, choices=TEST_TYPE_CHOICES, default='concrete_cube')
    sample_id = models.CharField(max_length=100, blank=True, default='')
    test_date = models.DateField()
    location = models.CharField(max_length=300, blank=True, default='')
    tested_by = models.CharField(max_length=200, blank=True, default='')
    lab_name = models.CharField(max_length=200, blank=True, default='')
    result = models.CharField(max_length=10, choices=RESULT_CHOICES, default='pending')
    value_obtained = models.CharField(max_length=100, blank=True, default='')
    required_value = models.CharField(max_length=100, blank=True, default='')
    unit = models.CharField(max_length=30, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='material_tests'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-test_date', '-created_at']

    def __str__(self):
        return f"{self.get_test_type_display()} — {self.sample_id or self.test_date}"


class PunchListItem(models.Model):
    PRIORITY_CHOICES = [
        ('low',      'Low'),
        ('medium',   'Medium'),
        ('high',     'High'),
        ('critical', 'Critical'),
    ]
    STATUS_CHOICES = [
        ('open',      'Open'),
        ('in_progress','In Progress'),
        ('closed',    'Closed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_name = models.CharField(max_length=200, blank=True, default='')
    project_id = models.UUIDField(null=True, blank=True, db_index=True)
    item_number = models.CharField(max_length=20, blank=True, default='')
    location = models.CharField(max_length=300, blank=True, default='')
    description = models.TextField()
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='open')
    assigned_to = models.CharField(max_length=200, blank=True, default='')
    due_date = models.DateField(null=True, blank=True)
    closed_date = models.DateField(null=True, blank=True)
    remarks = models.TextField(blank=True, default='')
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='punch_list_items'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['status', '-priority', 'due_date']

    def __str__(self):
        return f"#{self.item_number} {self.description[:50]}"

    @property
    def is_overdue(self):
        from django.utils import timezone
        if self.status == 'closed':
            return False
        return bool(self.due_date and self.due_date < timezone.now().date())
