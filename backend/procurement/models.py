import uuid
from django.db import models, transaction
from django.conf import settings
from django.utils import timezone
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


class GRNStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    CONFIRMED = "confirmed", "Confirmed"


class GRNItemCondition(models.TextChoices):
    GOOD = "good", "Good"
    DAMAGED = "damaged", "Damaged"
    REJECTED = "rejected", "Rejected"


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
    blacklist_reason = models.TextField(blank=True)
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
            with transaction.atomic():
                year = timezone.now().year
                count = PurchaseRequisition.objects.select_for_update().filter(
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
    cancellation_reason = models.TextField(blank=True)
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
            with transaction.atomic():
                year = timezone.now().year
                count = PurchaseOrder.objects.select_for_update().filter(
                    created_at__year=year
                ).count() + 1
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
    stock_item = models.ForeignKey(
        "inventory.StockItem", on_delete=models.SET_NULL,
        null=True, blank=True, related_name="po_line_items"
    )

    @property
    def line_total(self):
        return self.quantity * self.unit_price

    @property
    def is_fully_received(self):
        return self.received_quantity >= self.quantity


class GoodsReceivedNote(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    grn_number = models.CharField(max_length=20, unique=True, editable=False)
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.PROTECT, related_name="goods_received_notes")
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="goods_received_notes"
    )
    received_date = models.DateField()
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=GRNStatus.choices, default=GRNStatus.DRAFT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.grn_number

    def save(self, *args, **kwargs):
        if not self.grn_number:
            with transaction.atomic():
                year = timezone.now().year
                count = GoodsReceivedNote.objects.select_for_update().filter(
                    created_at__year=year
                ).count() + 1
                self.grn_number = f"GRN-{year}-{count:04d}"
        super().save(*args, **kwargs)

    def confirm(self, store=None):
        """Confirm GRN: update received quantities on PO line items and create stock transactions."""
        if self.status == GRNStatus.CONFIRMED:
            raise ValueError("GRN is already confirmed.")

        from inventory.models import StockTransaction, TransactionType, Store as InventoryStore
        import django.utils.timezone as tz

        with transaction.atomic():
            if store is None:
                store = InventoryStore.objects.filter(is_active=True).first()

            for grn_item in self.grn_items.select_related("po_line_item__stock_item"):
                po_line = grn_item.po_line_item
                POLineItem.objects.filter(pk=po_line.pk).update(
                    received_quantity=models.F("received_quantity") + grn_item.quantity_received
                )

                if po_line.stock_item and store:
                    ref = f"{self.grn_number}-{str(po_line.id)[:8]}"
                    StockTransaction.objects.create(
                        transaction_type=TransactionType.GRN,
                        item=po_line.stock_item,
                        store=store,
                        quantity=grn_item.quantity_received,
                        unit_cost=grn_item.unit_cost,
                        po=self.purchase_order,
                        reference_number=ref,
                        processed_by=self.received_by,
                        transaction_date=tz.now(),
                        notes=grn_item.notes,
                    )

            # Update PO status
            all_lines = list(POLineItem.objects.filter(po=self.purchase_order))
            fully_received = all(li.is_fully_received for li in all_lines)
            any_received = any(li.received_quantity > 0 for li in all_lines)
            po = self.purchase_order
            if fully_received:
                po.status = POStatus.RECEIVED
            elif any_received:
                po.status = POStatus.PARTIAL
            po.save(update_fields=["status"])

            self.status = GRNStatus.CONFIRMED
            self.save(update_fields=["status"])


class GRNItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    grn = models.ForeignKey(GoodsReceivedNote, on_delete=models.CASCADE, related_name="grn_items")
    po_line_item = models.ForeignKey(POLineItem, on_delete=models.PROTECT, related_name="grn_items")
    quantity_received = models.DecimalField(max_digits=14, decimal_places=4)
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2)
    condition = models.CharField(max_length=20, choices=GRNItemCondition.choices, default=GRNItemCondition.GOOD)
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"{self.grn.grn_number} — {self.po_line_item.description[:50]}"


# ── Phase 6: RFQ & Delivery Tracking ────────────────────────────────────────

class RFQStatus(models.TextChoices):
    DRAFT     = 'draft',     'Draft'
    ISSUED    = 'issued',    'Issued to Suppliers'
    EVALUATING= 'evaluating','Evaluating'
    AWARDED   = 'awarded',   'Awarded'
    CANCELLED = 'cancelled', 'Cancelled'


class RFQ(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rfq_number   = models.CharField(max_length=20, unique=True, editable=False)
    title        = models.CharField(max_length=255)
    description  = models.TextField(blank=True)
    project      = models.ForeignKey('projects.Project', on_delete=models.SET_NULL, null=True, blank=True, related_name='rfqs')
    category     = models.CharField(max_length=100, blank=True, help_text='e.g. civil materials, fuel, services')
    issue_date   = models.DateField(default=timezone.now)
    closing_date = models.DateField()
    status       = models.CharField(max_length=20, choices=RFQStatus.choices, default=RFQStatus.DRAFT)
    items        = models.JSONField(default=list, help_text='[{description, qty, unit}]')
    suppliers    = models.ManyToManyField(Supplier, blank=True, related_name='rfqs')
    awarded_to   = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True, related_name='awarded_rfqs')
    award_notes  = models.TextField(blank=True)
    created_by   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='rfqs_created')
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.rfq_number} — {self.title}'

    def save(self, *args, **kwargs):
        if not self.rfq_number:
            with transaction.atomic():
                year = timezone.now().year
                count = RFQ.objects.select_for_update().filter(created_at__year=year).count() + 1
                self.rfq_number = f'RFQ-{year}-{count:04d}'
        super().save(*args, **kwargs)

    @property
    def is_overdue(self):
        return self.status in (RFQStatus.DRAFT, RFQStatus.ISSUED) and timezone.now().date() > self.closing_date

    @property
    def quote_count(self):
        return self.quotes.count()


class RFQQuote(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rfq          = models.ForeignKey(RFQ, on_delete=models.CASCADE, related_name='quotes')
    supplier     = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='quotes_submitted')
    received_date= models.DateField(default=timezone.now)
    validity_days= models.PositiveIntegerField(default=30)
    line_items   = models.JSONField(default=list, help_text='[{description, qty, unit, unit_price, total}]')
    total_amount = models.DecimalField(max_digits=16, decimal_places=2, default=0)
    currency     = models.CharField(max_length=5, default='KES')
    delivery_days= models.PositiveIntegerField(null=True, blank=True)
    payment_terms= models.CharField(max_length=100, blank=True)
    notes        = models.TextField(blank=True)
    is_recommended = models.BooleanField(default=False)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['total_amount']
        unique_together = [['rfq', 'supplier']]

    def __str__(self):
        return f'{self.rfq.rfq_number} — {self.supplier.company_name}'


class PODeliverySchedule(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purchase_order  = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='delivery_schedule')
    milestone       = models.CharField(max_length=255)
    expected_date   = models.DateField()
    actual_date     = models.DateField(null=True, blank=True)
    quantity_expected = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    quantity_delivered= models.DecimalField(max_digits=14, decimal_places=4, default=0)
    status          = models.CharField(max_length=20, choices=[
        ('pending',   'Pending'),
        ('partial',   'Partial'),
        ('delivered', 'Delivered'),
        ('overdue',   'Overdue'),
    ], default='pending')
    notes           = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['expected_date']

    @property
    def is_overdue(self):
        return self.status in ('pending', 'partial') and timezone.now().date() > self.expected_date
