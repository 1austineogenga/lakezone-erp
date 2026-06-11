import uuid
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
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["item_code"]

    def __str__(self):
        return f"{self.item_code} — {self.name}"

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
    processed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="stock_transactions"
    )
    transaction_date = models.DateTimeField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-transaction_date"]

    def __str__(self):
        return f"{self.reference_number} — {self.transaction_type}"

    def save(self, *args, **kwargs):
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
