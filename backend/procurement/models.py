import uuid
from django.db import models
from django.conf import settings
from projects.models import Project, BOQItem


class PRStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PENDING = "pending", "Pending Dept Approval"
    DEPT_APPROVED = "dept_approved", "Dept Approved"
    PROCUREMENT_REVIEW = "procurement_review", "Procurement Review"
    FINANCE_APPROVED = "finance_approved", "Finance Approved"
    MD_APPROVED = "md_approved", "MD Approved"
    REJECTED = "rejected", "Rejected"
    CONVERTED = "converted", "Converted to PO"


class SupplierStatus(models.TextChoices):
    PENDING = "pending", "Pending Approval"
    ACTIVE = "active", "Active"
    BLACKLISTED = "blacklisted", "Blacklisted"


class POStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    APPROVED = "approved", "Approved"
    SENT = "sent", "Sent to Supplier"
    PARTIAL = "partial", "Partially Received"
    RECEIVED = "received", "Fully Received"
    CANCELLED = "cancelled", "Cancelled"


class Supplier(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_name = models.CharField(max_length=255)
    kra_pin = models.CharField(max_length=20, unique=True)
    vat_number = models.CharField(max_length=20, blank=True)
    contact_person = models.CharField(max_length=200)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    payment_terms = models.CharField(max_length=100)
    supply_categories = models.JSONField(default=list, help_text="e.g. ['materials', 'fuel', 'services']")
    performance_rating = models.DecimalField(max_digits=3, decimal_places=1, default=0)
    status = models.CharField(max_length=20, choices=SupplierStatus.choices, default=SupplierStatus.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["company_name"]

    def __str__(self):
        return f"{self.company_name} ({self.kra_pin})"


class PurchaseRequisition(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pr_number = models.CharField(max_length=20, unique=True, editable=False)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="purchase_requisitions"
    )
    department = models.ForeignKey("core.Department", on_delete=models.PROTECT)
    project = models.ForeignKey(
        Project, on_delete=models.SET_NULL, null=True, blank=True, related_name="purchase_requisitions"
    )
    boq_item = models.ForeignKey(
        BOQItem, on_delete=models.SET_NULL, null=True, blank=True, related_name="purchase_requisitions"
    )
    required_by_date = models.DateField()
    status = models.CharField(max_length=30, choices=PRStatus.choices, default=PRStatus.DRAFT)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.pr_number

    def save(self, *args, **kwargs):
        if not self.pr_number:
            from django.utils import timezone
            year = timezone.now().year
            count = PurchaseRequisition.objects.filter(
                created_at__year=year
            ).count() + 1
            self.pr_number = f"PR-{year}-{count:04d}"
        super().save(*args, **kwargs)

    @property
    def total_estimated_value(self):
        return self.line_items.aggregate(
            total=models.Sum(models.F("quantity") * models.F("estimated_unit_rate"))
        )["total"] or 0


class PRLineItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pr = models.ForeignKey(PurchaseRequisition, on_delete=models.CASCADE, related_name="line_items")
    description = models.CharField(max_length=500)
    unit = models.CharField(max_length=20)
    quantity = models.DecimalField(max_digits=14, decimal_places=4)
    estimated_unit_rate = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.pr.pr_number} — {self.description[:50]}"


class PRApproval(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pr = models.ForeignKey(PurchaseRequisition, on_delete=models.CASCADE, related_name="approvals")
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    action = models.CharField(max_length=20, choices=[("approved", "Approved"), ("rejected", "Rejected")])
    stage = models.CharField(max_length=30)
    comment = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["timestamp"]


class PurchaseOrder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    po_number = models.CharField(max_length=20, unique=True, editable=False)
    pr = models.ForeignKey(
        PurchaseRequisition, on_delete=models.PROTECT, null=True, blank=True, related_name="purchase_orders"
    )
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="purchase_orders")
    project = models.ForeignKey(
        Project, on_delete=models.SET_NULL, null=True, blank=True, related_name="purchase_orders"
    )
    delivery_date = models.DateField()
    delivery_address = models.CharField(max_length=500)
    status = models.CharField(max_length=20, choices=POStatus.choices, default=POStatus.DRAFT)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_pos"
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="approved_pos"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.po_number

    def save(self, *args, **kwargs):
        if not self.po_number:
            from django.utils import timezone
            year = timezone.now().year
            count = PurchaseOrder.objects.filter(created_at__year=year).count() + 1
            self.po_number = f"PO-{year}-{count:04d}"
        super().save(*args, **kwargs)

    @property
    def total_value(self):
        return self.line_items.aggregate(
            total=models.Sum(models.F("quantity") * models.F("unit_price"))
        )["total"] or 0


class POLineItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    po = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="line_items")
    description = models.CharField(max_length=500)
    unit = models.CharField(max_length=20)
    quantity = models.DecimalField(max_digits=14, decimal_places=4)
    unit_price = models.DecimalField(max_digits=14, decimal_places=2)
    received_quantity = models.DecimalField(max_digits=14, decimal_places=4, default=0)

    @property
    def line_total(self):
        return self.quantity * self.unit_price

    @property
    def is_fully_received(self):
        return self.received_quantity >= self.quantity
