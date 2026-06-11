import uuid
from django.db import models
from django.conf import settings


class ProjectStatus(models.TextChoices):
    TENDERING = "tendering", "Tendering"
    ACTIVE = "active", "Active"
    SUSPENDED = "suspended", "Suspended"
    COMPLETED = "completed", "Completed"


class TenderStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SUBMITTED = "submitted", "Submitted"
    AWARDED = "awarded", "Awarded"
    LOST = "lost", "Lost"
    CANCELLED = "cancelled", "Cancelled"


class BOQVersion(models.TextChoices):
    ORIGINAL = "original", "Original"
    REVISED = "revised", "Revised"
    VARIATION = "variation_order", "Variation Order"


class Project(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_name = models.CharField(max_length=255)
    # client_id deferred until CRM app is wired
    client_name = models.CharField(max_length=255, blank=True)
    contract_number = models.CharField(max_length=100, unique=True)
    project_manager = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="managed_projects",
        limit_choices_to={"role": "project_manager"},
    )
    start_date = models.DateField()
    end_date = models.DateField()
    contract_sum = models.DecimalField(max_digits=18, decimal_places=2)
    project_location = models.CharField(max_length=500)
    status = models.CharField(max_length=20, choices=ProjectStatus.choices, default=ProjectStatus.TENDERING)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_projects",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.contract_number} — {self.project_name}"

    @property
    def total_boq_budget(self):
        return self.tenders.aggregate(
            total=models.Sum("boq_items__total_cost")
        )["total"] or 0

    @property
    def total_actual_cost(self):
        return self.tenders.aggregate(
            total=models.Sum("boq_items__actual_cost")
        )["total"] or 0


class Tender(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="tenders")
    tender_number = models.CharField(max_length=100, unique=True)
    tender_description = models.TextField()
    tender_value = models.DecimalField(max_digits=18, decimal_places=2)
    tender_status = models.CharField(
        max_length=20, choices=TenderStatus.choices, default=TenderStatus.DRAFT
    )
    submission_date = models.DateField(null=True, blank=True)
    award_date = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_tenders"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.tender_number} ({self.get_tender_status_display()})"


class BOQItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tender = models.ForeignKey(Tender, on_delete=models.CASCADE, related_name="boq_items")
    item_code = models.CharField(max_length=50)
    description = models.TextField()
    unit = models.CharField(max_length=20)
    quantity = models.DecimalField(max_digits=14, decimal_places=4)
    unit_rate = models.DecimalField(max_digits=14, decimal_places=2)
    # total_cost is computed: quantity × unit_rate
    total_cost = models.DecimalField(max_digits=18, decimal_places=2, editable=False, default=0)
    # actual_cost is aggregated from linked cost records
    actual_cost = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    progress_percent = models.DecimalField(
        max_digits=5, decimal_places=2, default=0,
        help_text="Physical completion percentage (0-100)"
    )
    boq_version = models.CharField(
        max_length=20, choices=BOQVersion.choices, default=BOQVersion.ORIGINAL
    )
    parent_boq_item = models.ForeignKey(
        "self", on_delete=models.SET_NULL, null=True, blank=True, related_name="revisions"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["item_code"]

    def __str__(self):
        return f"{self.item_code} — {self.description[:60]}"

    def save(self, *args, **kwargs):
        self.total_cost = self.quantity * self.unit_rate
        super().save(*args, **kwargs)

    @property
    def budget_variance(self):
        return self.total_cost - self.actual_cost

    @property
    def cost_performance_index(self):
        """CPI = budgeted cost of work performed / actual cost."""
        if self.actual_cost == 0:
            return None
        earned_value = self.total_cost * (self.progress_percent / 100)
        return float(earned_value) / float(self.actual_cost)


class ProjectDocument(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="documents")
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to="project_documents/%Y/%m/")
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="uploaded_documents"
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.project.contract_number} — {self.title}"
