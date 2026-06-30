import uuid
from django.core.exceptions import ValidationError
from django.db import models
from django.conf import settings
from projects.models import Project, BOQItem
from procurement.models import PurchaseOrder


class ItemCategory(models.TextChoices):
    CONSTRUCTION_MATERIALS = "construction_materials", "Construction Materials"
    SPARE_PARTS = "spare_parts", "Spare Parts"
    FUEL = "fuel", "Fuel & Lubricants"
    PPE_SAFETY = "ppe_safety", "PPE & Safety"
    OFFICE_CONSUMABLES = "office_consumables", "Office Consumables"
    OTHER = "other", "Other"


class ValuationMethod(models.TextChoices):
    FIFO = "fifo", "FIFO"
    WAC = "wac", "Weighted Average Cost"


class TransactionType(models.TextChoices):
    GRN = "grn", "Goods Received Note"
    ISSUE = "issue", "Stock Issue"
    TRANSFER = "transfer", "Store Transfer"
    RETURN = "return", "Return to Store"
    ADJUSTMENT = "adjustment", "Adjustment"


class Store(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=500)
    storekeeper = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True
    )
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class StockItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item_code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    category = models.CharField(max_length=30, choices=ItemCategory.choices)
    unit = models.CharField(max_length=20)
    reorder_level = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    valuation_method = models.CharField(
        max_length=10, choices=ValuationMethod.choices, default=ValuationMethod.WAC
    )
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    department = models.ForeignKey(
        'core.Department', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='stock_items',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["item_code"]

    def __str__(self):
        return f"{self.item_code} — {self.name}"

    def clean(self):
        if self.reorder_level is not None and self.reorder_level < 0:
            raise ValidationError({"reorder_level": "Reorder level must be >= 0."})

    def current_stock(self, store=None):
        qs = self.stock_levels.all()
        if store:
            qs = qs.filter(store=store)
        return qs.aggregate(total=models.Sum("quantity_on_hand"))["total"] or 0


class StockLevel(models.Model):
    """Denormalised current stock balance per item per store."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    item = models.ForeignKey(StockItem, on_delete=models.CASCADE, related_name="stock_levels")
    store = models.ForeignKey(Store, on_delete=models.CASCADE, related_name="stock_levels")
    quantity_on_hand = models.DecimalField(max_digits=14, decimal_places=4, default=0)
    weighted_avg_cost = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ["item", "store"]

    def __str__(self):
        return f"{self.item.item_code} @ {self.store.name}: {self.quantity_on_hand}"


class StockTransaction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    transaction_type = models.CharField(max_length=20, choices=TransactionType.choices)
    item = models.ForeignKey(StockItem, on_delete=models.PROTECT, related_name="transactions")
    store = models.ForeignKey(Store, on_delete=models.PROTECT, related_name="transactions")
    destination_store = models.ForeignKey(
        Store, on_delete=models.PROTECT, null=True, blank=True, related_name="inbound_transfers"
    )
    quantity = models.DecimalField(max_digits=14, decimal_places=4)
    unit_cost = models.DecimalField(max_digits=14, decimal_places=2)
    project = models.ForeignKey(
        Project, on_delete=models.SET_NULL, null=True, blank=True, related_name="stock_transactions"
    )
    boq_item = models.ForeignKey(
        BOQItem, on_delete=models.SET_NULL, null=True, blank=True
    )
    po = models.ForeignKey(
        PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True, related_name="grns"
    )
    reference_number = models.CharField(max_length=50, unique=True)
    reason = models.TextField(
        blank=True,
        help_text="Required for ADJUSTMENT transactions. Explain why the adjustment is being made.",
    )
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="stock_transactions"
    )
    transaction_date = models.DateTimeField()
    notes = models.TextField(blank=True)
    issued_to = models.ForeignKey(
        'core.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='received_stock_items',
        help_text='System user who received the issued item'
    )
    issued_to_name = models.CharField(
        max_length=200, blank=True,
        help_text='Name of recipient if not a system user'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-transaction_date"]

    def __str__(self):
        return f"{self.reference_number} — {self.transaction_type}"

    def clean(self):
        errors = {}
        # quantity must be positive
        if self.quantity is not None and self.quantity <= 0:
            errors["quantity"] = "Quantity must be greater than 0."
        # unit_cost must be non-negative
        if self.unit_cost is not None and self.unit_cost < 0:
            errors["unit_cost"] = "Unit cost must be >= 0."
        # adjustments require a reason
        if self.transaction_type == TransactionType.ADJUSTMENT and not self.reason:
            errors["reason"] = "A reason is required for stock adjustments."
        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        # Check for negative stock on outbound transactions (before saving)
        if self.transaction_type in (TransactionType.ISSUE, TransactionType.TRANSFER):
            try:
                current = StockLevel.objects.get(item=self.item, store=self.store)
                if current.quantity_on_hand - self.quantity < 0:
                    raise ValidationError(
                        f"Insufficient stock: {self.item} has {current.quantity_on_hand} units in "
                        f"{self.store}; cannot issue/transfer {self.quantity}."
                    )
            except StockLevel.DoesNotExist:
                raise ValidationError(
                    f"No stock record found for {self.item} in {self.store}. Cannot issue/transfer."
                )
        super().save(*args, **kwargs)
        self._update_stock_level()
        if self.project and self.boq_item and self.transaction_type == TransactionType.ISSUE:
            self._allocate_cost_to_boq()

    def _update_stock_level(self):
        stock_level, _ = StockLevel.objects.get_or_create(
            item=self.item, store=self.store,
            defaults={"quantity_on_hand": 0, "weighted_avg_cost": 0},
        )
        if self.transaction_type in (TransactionType.GRN, TransactionType.RETURN):
            # Update WAC
            current_value = stock_level.quantity_on_hand * stock_level.weighted_avg_cost
            new_value = self.quantity * self.unit_cost
            new_qty = stock_level.quantity_on_hand + self.quantity
            if new_qty > 0:
                stock_level.weighted_avg_cost = (current_value + new_value) / new_qty
            stock_level.quantity_on_hand = new_qty
        elif self.transaction_type in (TransactionType.ISSUE, TransactionType.TRANSFER):
            stock_level.quantity_on_hand -= self.quantity
        stock_level.save()

    def _allocate_cost_to_boq(self):
        total_cost = self.quantity * self.unit_cost
        self.boq_item.actual_cost = models.F("actual_cost") + total_cost
        self.boq_item.save(update_fields=["actual_cost"])


# ---------------------------------------------------------------------------
# Fixed Assets Register
# ---------------------------------------------------------------------------

class Asset(models.Model):
    CATEGORY_CHOICES = [
        ('machinery', 'Machinery & Plant'),
        ('vehicles', 'Vehicles (Cars / SUVs / Double Cabs)'),
        ('trucks_tracks', 'Trucks & Tracks'),
        ('it_equipment', 'IT Equipment'),
        ('furniture', 'Furniture & Fittings'),
        ('office_equipment', 'Office Equipment'),
        ('tools', 'Tools & Equipment'),
        ('communication', 'Communication Equipment'),
        ('safety', 'Safety Equipment'),
        ('other', 'Other'),
    ]
    CONDITION_CHOICES = [
        ('new', 'New'),
        ('good', 'Good'),
        ('fair', 'Fair'),
        ('poor', 'Poor'),
        ('condemned', 'Condemned'),
    ]
    STATUS_CHOICES = [
        ('operational', 'Operational'),
        ('functional', 'Functional'),
        ('non_operational', 'Non-Operational'),
        ('undetermined', 'Undetermined'),
        ('active', 'Active'),
        ('under_repair', 'Under Repair'),
        ('disposed', 'Disposed'),
        ('lost', 'Lost'),
    ]
    CERT_STATUS_CHOICES = [
        ('valid', 'Valid'),
        ('expired', 'Expired'),
        ('not_in_system', 'Not in System'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asset_code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    department = models.CharField(max_length=100)
    serial_number = models.CharField(max_length=100, blank=True)
    make_model = models.CharField(max_length=200, blank=True)
    purchase_date = models.DateField(null=True, blank=True)
    purchase_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    current_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    condition = models.CharField(max_length=20, choices=CONDITION_CHOICES, default='good')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='operational')
    location = models.CharField(max_length=200, blank=True)
    assigned_to = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)

    # Machinery-specific
    hours_to_next_service = models.DecimalField(max_digits=8, decimal_places=1, null=True, blank=True)

    # Vehicle / Truck fields
    registration_plate = models.CharField(max_length=20, blank=True)
    kms_to_next_service = models.IntegerField(null=True, blank=True)
    insurance_expiry = models.DateField(null=True, blank=True)

    # Insurance certificate (vehicles & trucks)
    insurance_cert_number = models.CharField(max_length=50, blank=True)
    insurance_policy_number = models.CharField(max_length=100, blank=True)
    insurance_policy_type = models.CharField(max_length=50, blank=True, help_text="e.g. Comprehensive, Third Party")
    insurance_insurer = models.CharField(max_length=200, blank=True)
    insurance_chassis_number = models.CharField(max_length=100, blank=True)
    insurance_commencement_date = models.DateField(null=True, blank=True)

    # Inspection certificate (trucks & tracks)
    inspection_cert_number = models.CharField(max_length=50, blank=True)
    inspection_cert_status = models.CharField(max_length=20, choices=CERT_STATUS_CHOICES, blank=True)
    inspection_cert_issue_date = models.DateField(null=True, blank=True)
    inspection_cert_expiry = models.DateField(null=True, blank=True)
    inspection_issuing_authority = models.CharField(max_length=200, blank=True)

    # Speed governor certificate (trucks & tracks)
    speed_governor_cert_number = models.CharField(max_length=50, blank=True)
    speed_governor_cert_status = models.CharField(max_length=20, choices=CERT_STATUS_CHOICES, blank=True)
    speed_governor_device_serial = models.CharField(max_length=100, blank=True)
    speed_governor_cert_issue_date = models.DateField(null=True, blank=True)
    speed_governor_cert_expiry = models.DateField(null=True, blank=True)
    speed_governor_issuing_authority = models.CharField(max_length=200, blank=True)

    # Defects & requirements tracking
    current_defects = models.TextField(blank=True)
    requirements = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['department', 'category', 'asset_code']

    def save(self, *args, **kwargs):
        if not self.asset_code:
            prefix = self.category[:2].upper() if self.category else 'AS'
            count = Asset.objects.filter(category=self.category).count() + 1
            self.asset_code = f"LZ-{prefix.upper()}-{count:03d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.asset_code} - {self.name}"


class AssetMaintenanceLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name='maintenance_logs')
    date = models.DateField()
    description = models.TextField()
    cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    performed_by = models.CharField(max_length=200, blank=True)
    next_service_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.asset.asset_code} - {self.date}"
