import uuid
from django.conf import settings
from django.db import models


class HSEIncident(models.Model):
    TYPE_CHOICES = [
        ('near_miss',     'Near Miss'),
        ('first_aid',     'First Aid'),
        ('medical',       'Medical Treatment'),
        ('lost_time',     'Lost Time Injury'),
        ('fatality',      'Fatality'),
        ('property',      'Property Damage'),
        ('environmental', 'Environmental'),
        ('other',         'Other'),
    ]
    SEVERITY_CHOICES = [
        ('low',      'Low'),
        ('medium',   'Medium'),
        ('high',     'High'),
        ('critical', 'Critical'),
    ]
    STATUS_CHOICES = [
        ('open',          'Open'),
        ('investigating', 'Investigating'),
        ('closed',        'Closed'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_name = models.CharField(max_length=200, blank=True, default='')
    project_id = models.UUIDField(null=True, blank=True, db_index=True)
    date = models.DateField()
    time = models.TimeField(null=True, blank=True)
    location = models.CharField(max_length=300)
    incident_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='near_miss')
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='low')
    description = models.TextField()
    persons_involved = models.TextField(blank=True, default='')
    immediate_action = models.TextField(blank=True, default='')
    root_cause = models.TextField(blank=True, default='')
    corrective_action = models.TextField(blank=True, default='')
    corrective_action_due = models.DateField(null=True, blank=True)
    corrective_action_completed = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='hse_incidents'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.get_incident_type_display()} — {self.date} — {self.location}"

    @property
    def is_overdue(self):
        from django.utils import timezone
        if self.status == 'closed':
            return False
        if self.corrective_action_due:
            return self.corrective_action_due < timezone.now().date()
        return False


class ToolboxTalk(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_name = models.CharField(max_length=200, blank=True, default='')
    project_id = models.UUIDField(null=True, blank=True, db_index=True)
    date = models.DateField()
    topic = models.CharField(max_length=300)
    conducted_by = models.CharField(max_length=200)
    location = models.CharField(max_length=200, blank=True, default='')
    duration_minutes = models.PositiveIntegerField(default=15)
    summary = models.TextField(blank=True, default='')
    attendees = models.JSONField(default=list)
    attendee_count = models.PositiveIntegerField(default=0)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='toolbox_talks'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.topic} — {self.date}"


class SiteInduction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_name = models.CharField(max_length=200, blank=True, default='')
    project_id = models.UUIDField(null=True, blank=True, db_index=True)
    person_name = models.CharField(max_length=200)
    company = models.CharField(max_length=200, blank=True, default='')
    role = models.CharField(max_length=100, blank=True, default='')
    induction_date = models.DateField()
    inducted_by = models.CharField(max_length=200, blank=True, default='')
    topics_covered = models.TextField(blank=True, default='')
    expiry_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, default='')
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='site_inductions'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-induction_date', '-created_at']

    def __str__(self):
        return f"{self.person_name} inducted on {self.induction_date}"

    @property
    def is_expired(self):
        from django.utils import timezone
        if self.expiry_date:
            return self.expiry_date < timezone.now().date()
        return False


class PPEIssuance(models.Model):
    PPE_ITEMS = [
        ('helmet',     'Safety Helmet'),
        ('vest',       'High-Vis Vest'),
        ('boots',      'Safety Boots'),
        ('gloves',     'Gloves'),
        ('goggles',    'Safety Goggles'),
        ('earplugs',   'Ear Plugs / Muffs'),
        ('harness',    'Safety Harness'),
        ('respirator', 'Respirator / Mask'),
        ('coverall',   'Coverall'),
        ('other',      'Other'),
    ]
    CONDITION_CHOICES = [
        ('new',  'New'),
        ('good', 'Good'),
        ('worn', 'Worn'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_name = models.CharField(max_length=200, blank=True, default='')
    project_id = models.UUIDField(null=True, blank=True, db_index=True)
    person_name = models.CharField(max_length=200)
    employee_id = models.CharField(max_length=100, blank=True, default='')
    ppe_item = models.CharField(max_length=20, choices=PPE_ITEMS, default='helmet')
    ppe_description = models.CharField(max_length=200, blank=True, default='')
    quantity = models.PositiveIntegerField(default=1)
    size = models.CharField(max_length=20, blank=True, default='')
    issue_date = models.DateField()
    condition = models.CharField(max_length=10, choices=CONDITION_CHOICES, default='new')
    notes = models.TextField(blank=True, default='')
    issued_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='ppe_issuances'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-issue_date', '-created_at']

    def __str__(self):
        return f"{self.get_ppe_item_display()} → {self.person_name} on {self.issue_date}"
