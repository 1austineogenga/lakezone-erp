import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


def drawing_upload_path(instance, filename):
    return f'documents/drawings/{instance.project_id}/{filename}'


def submittal_upload_path(instance, filename):
    return f'documents/submittals/{instance.project_id}/{filename}'


DISCIPLINE_CHOICES = [
    ('civil',       'Civil'),
    ('structural',  'Structural'),
    ('architectural','Architectural'),
    ('mechanical',  'Mechanical'),
    ('electrical',  'Electrical'),
    ('plumbing',    'Plumbing'),
    ('survey',      'Survey / GIS'),
    ('geotechnical','Geotechnical'),
    ('environmental','Environmental'),
    ('other',       'Other'),
]

DRAWING_STATUS = [
    ('draft',            'Draft'),
    ('issued_for_review','Issued for Review'),
    ('issued_for_construction','Issued for Construction'),
    ('as_built',         'As Built'),
    ('superseded',       'Superseded'),
    ('void',             'Void'),
]

RFI_STATUS = [
    ('open',       'Open'),
    ('responded',  'Responded'),
    ('closed',     'Closed'),
    ('cancelled',  'Cancelled'),
]

SUBMITTAL_TYPE = [
    ('material_sample', 'Material Sample'),
    ('shop_drawing',    'Shop Drawing'),
    ('product_data',    'Product Data'),
    ('method_statement','Method Statement'),
    ('mix_design',      'Mix Design'),
    ('test_report',     'Test Report'),
    ('certificate',     'Certificate'),
    ('other',           'Other'),
]

SUBMITTAL_STATUS = [
    ('submitted',       'Submitted'),
    ('under_review',    'Under Review'),
    ('approved',        'Approved'),
    ('approved_as_noted','Approved as Noted'),
    ('revise_resubmit', 'Revise & Resubmit'),
    ('rejected',        'Rejected'),
]


class Drawing(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_name    = models.CharField(max_length=255)
    project_id      = models.UUIDField(null=True, blank=True, db_index=True)
    drawing_number  = models.CharField(max_length=50)
    title           = models.CharField(max_length=255)
    discipline      = models.CharField(max_length=30, choices=DISCIPLINE_CHOICES, default='civil')
    revision        = models.CharField(max_length=10, default='A')
    status          = models.CharField(max_length=30, choices=DRAWING_STATUS, default='draft')
    scale           = models.CharField(max_length=50, blank=True)
    drawn_by        = models.CharField(max_length=100, blank=True)
    checked_by      = models.CharField(max_length=100, blank=True)
    issue_date      = models.DateField(null=True, blank=True)
    file            = models.FileField(upload_to=drawing_upload_path, null=True, blank=True)
    notes           = models.TextField(blank=True)
    uploaded_by     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='drawings')
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['drawing_number', '-revision']

    def __str__(self):
        return f'{self.drawing_number} Rev {self.revision} — {self.title}'

    @property
    def file_url(self):
        return self.file.url if self.file else None


class RFI(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_name    = models.CharField(max_length=255)
    project_id      = models.UUIDField(null=True, blank=True, db_index=True)
    rfi_number      = models.CharField(max_length=30)
    subject         = models.CharField(max_length=255)
    description     = models.TextField()
    raised_by       = models.CharField(max_length=100, blank=True)
    directed_to     = models.CharField(max_length=100, blank=True)
    date_raised     = models.DateField(default=timezone.now)
    response_due    = models.DateField(null=True, blank=True)
    response        = models.TextField(blank=True)
    responded_by    = models.CharField(max_length=100, blank=True)
    date_responded  = models.DateField(null=True, blank=True)
    status          = models.CharField(max_length=20, choices=RFI_STATUS, default='open')
    created_by      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='rfis')
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date_raised']

    def __str__(self):
        return f'RFI-{self.rfi_number}: {self.subject}'

    @property
    def is_overdue(self):
        if self.status == 'open' and self.response_due:
            return timezone.now().date() > self.response_due
        return False


class Submittal(models.Model):
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_name        = models.CharField(max_length=255)
    project_id          = models.UUIDField(null=True, blank=True, db_index=True)
    submittal_number    = models.CharField(max_length=30)
    title               = models.CharField(max_length=255)
    submittal_type      = models.CharField(max_length=30, choices=SUBMITTAL_TYPE, default='material_sample')
    description         = models.TextField(blank=True)
    submitted_by        = models.CharField(max_length=100, blank=True)
    reviewer            = models.CharField(max_length=100, blank=True)
    date_submitted      = models.DateField(default=timezone.now)
    review_due          = models.DateField(null=True, blank=True)
    date_reviewed       = models.DateField(null=True, blank=True)
    status              = models.CharField(max_length=20, choices=SUBMITTAL_STATUS, default='submitted')
    review_comments     = models.TextField(blank=True)
    file                = models.FileField(upload_to=submittal_upload_path, null=True, blank=True)
    created_by          = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='submittals')
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date_submitted']

    def __str__(self):
        return f'SUB-{self.submittal_number}: {self.title}'

    @property
    def is_overdue(self):
        if self.status in ('submitted', 'under_review') and self.review_due:
            return timezone.now().date() > self.review_due
        return False
