import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


def inv_ref():
    from datetime import date
    year = date.today().year
    count = Invoice.objects.filter(invoice_number__startswith=f'INV-{year}-').count()
    return f'INV-{year}-{str(count + 1).zfill(4)}'


def bill_ref():
    from datetime import date
    year = date.today().year
    count = Bill.objects.filter(bill_number__startswith=f'BILL-{year}-').count()
    return f'BILL-{year}-{str(count + 1).zfill(4)}'


# ── Chart of Accounts ──────────────────────────────────────────────────────────

class Account(models.Model):
    class AccountType(models.TextChoices):
        ASSET     = 'asset',     'Asset'
        LIABILITY = 'liability', 'Liability'
        EQUITY    = 'equity',    'Equity'
        REVENUE   = 'revenue',   'Revenue'
        EXPENSE   = 'expense',   'Expense'

    class CostCode(models.TextChoices):
        MATERIALS     = 'materials',     'Materials'
        LABOUR        = 'labour',        'Labour'
        PLANT         = 'plant',         'Plant & Equipment'
        SUBCONTRACTOR = 'subcontractor', 'Subcontractor'
        PRELIMINARIES = 'preliminaries', 'Preliminaries'
        OVERHEAD      = 'overhead',      'Overhead'
        OTHER         = 'other',         'Other'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code         = models.CharField(max_length=20, unique=True)
    name         = models.CharField(max_length=255)
    account_type = models.CharField(max_length=15, choices=AccountType.choices)
    cost_code    = models.CharField(max_length=20, choices=CostCode.choices,
                                    default=CostCode.OTHER, blank=True)
    parent       = models.ForeignKey('self', null=True, blank=True,
                                     on_delete=models.SET_NULL, related_name='children')
    description  = models.TextField(blank=True)
    is_active    = models.BooleanField(default=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['code']

    def __str__(self):
        return f'{self.code} — {self.name}'


# ── Accounts Receivable (Client Invoices / IPCs) ───────────────────────────────

class Invoice(models.Model):
    class InvoiceType(models.TextChoices):
        PROGRESS_CLAIM = 'progress_claim', 'Progress Claim (IPC)'
        VARIATION      = 'variation',      'Variation Order'
        ADVANCE        = 'advance',        'Advance Payment'
        FINAL          = 'final',          'Final Account'
        OTHER          = 'other',          'Other'

    class Status(models.TextChoices):
        DRAFT     = 'draft',     'Draft'
        SENT      = 'sent',      'Sent to Client'
        CERTIFIED = 'certified', 'Certified'
        PARTIAL   = 'partial',   'Partially Paid'
        PAID      = 'paid',      'Fully Paid'
        OVERDUE   = 'overdue',   'Overdue'
        DISPUTED  = 'disputed',  'Disputed'
        CANCELLED = 'cancelled', 'Cancelled'

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice_number = models.CharField(max_length=20, unique=True, blank=True)
    invoice_type   = models.CharField(max_length=20, choices=InvoiceType.choices,
                                      default=InvoiceType.PROGRESS_CLAIM)
    client         = models.ForeignKey('crm.Client', on_delete=models.PROTECT,
                                       related_name='invoices')
    project        = models.ForeignKey('projects.Project', on_delete=models.SET_NULL,
                                       null=True, blank=True, related_name='invoices')
    status         = models.CharField(max_length=15, choices=Status.choices,
                                      default=Status.DRAFT)

    issue_date       = models.DateField(default=timezone.now)
    due_date         = models.DateField()
    period_from      = models.DateField(null=True, blank=True)
    period_to        = models.DateField(null=True, blank=True)

    subtotal         = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    vat_rate         = models.DecimalField(max_digits=5, decimal_places=2, default=16)
    vat_amount       = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    retention_rate   = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    retention_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount     = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    amount_paid      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    balance_due      = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    notes      = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   related_name='invoices_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-issue_date']

    def __str__(self):
        return f'{self.invoice_number} — {self.client}'

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            self.invoice_number = inv_ref()
        self.vat_amount       = self.subtotal * self.vat_rate / 100
        self.retention_amount = self.subtotal * self.retention_rate / 100
        self.total_amount     = self.subtotal + self.vat_amount - self.retention_amount
        self.balance_due      = self.total_amount - self.amount_paid
        super().save(*args, **kwargs)

    def recalculate(self):
        self.subtotal = sum(line.amount for line in self.lines.all())
        self.save()


class InvoiceLine(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice     = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='lines')
    description = models.CharField(max_length=255)
    quantity    = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_price  = models.DecimalField(max_digits=15, decimal_places=2)
    amount      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    account     = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True)

    def save(self, *args, **kwargs):
        self.amount = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    def __str__(self):
        return self.description


# ── Accounts Payable (Vendor / Subcontractor Bills) ────────────────────────────

class Bill(models.Model):
    class BillType(models.TextChoices):
        SUPPLIER      = 'supplier',      'Supplier Invoice'
        SUBCONTRACTOR = 'subcontractor', 'Subcontractor Certificate'
        UTILITY       = 'utility',       'Utility / Overhead'
        PROFESSIONAL  = 'professional',  'Professional Fee'
        OTHER         = 'other',         'Other'

    class Status(models.TextChoices):
        DRAFT    = 'draft',    'Draft'
        PENDING  = 'pending',  'Pending Approval'
        APPROVED = 'approved', 'Approved'
        PARTIAL  = 'partial',  'Partially Paid'
        PAID     = 'paid',     'Fully Paid'
        OVERDUE  = 'overdue',  'Overdue'
        DISPUTED = 'disputed', 'Disputed'

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bill_number    = models.CharField(max_length=20, unique=True, blank=True)
    bill_type      = models.CharField(max_length=20, choices=BillType.choices,
                                      default=BillType.SUPPLIER)
    supplier       = models.ForeignKey('procurement.Supplier', on_delete=models.PROTECT,
                                       related_name='bills')
    project        = models.ForeignKey('projects.Project', on_delete=models.SET_NULL,
                                       null=True, blank=True, related_name='bills')
    purchase_order = models.ForeignKey('procurement.PurchaseOrder', on_delete=models.SET_NULL,
                                       null=True, blank=True, related_name='bills')
    status         = models.CharField(max_length=15, choices=Status.choices,
                                      default=Status.DRAFT)

    issue_date      = models.DateField()
    due_date        = models.DateField()
    supplier_ref    = models.CharField(max_length=100, blank=True)

    subtotal        = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    vat_amount      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    withholding_tax = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_amount    = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    amount_paid     = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    balance_due     = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    notes      = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   related_name='bills_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-issue_date']

    def __str__(self):
        return f'{self.bill_number} — {self.supplier}'

    def save(self, *args, **kwargs):
        if not self.bill_number:
            self.bill_number = bill_ref()
        self.balance_due = self.total_amount - self.amount_paid - self.withholding_tax
        super().save(*args, **kwargs)

    def recalculate(self):
        self.subtotal     = sum(line.amount for line in self.lines.all())
        self.total_amount = self.subtotal + self.vat_amount
        self.save()


class BillLine(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bill        = models.ForeignKey(Bill, on_delete=models.CASCADE, related_name='lines')
    description = models.CharField(max_length=255)
    quantity    = models.DecimalField(max_digits=10, decimal_places=2, default=1)
    unit_price  = models.DecimalField(max_digits=15, decimal_places=2)
    amount      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    account     = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True)
    cost_code   = models.CharField(max_length=20, choices=Account.CostCode.choices, blank=True)

    def save(self, *args, **kwargs):
        self.amount = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    def __str__(self):
        return self.description


# ── Payments ───────────────────────────────────────────────────────────────────

class Payment(models.Model):
    class PaymentMethod(models.TextChoices):
        BANK_TRANSFER = 'bank_transfer', 'Bank Transfer'
        CHEQUE        = 'cheque',        'Cheque'
        MPESA         = 'mpesa',         'M-Pesa'
        CASH          = 'cash',          'Cash'

    class PaymentType(models.TextChoices):
        RECEIPT = 'receipt', 'Receipt (from Client)'
        PAYMENT = 'payment', 'Payment (to Supplier)'

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment_type   = models.CharField(max_length=10, choices=PaymentType.choices)
    payment_method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    invoice        = models.ForeignKey(Invoice, on_delete=models.SET_NULL,
                                       null=True, blank=True, related_name='payments')
    bill           = models.ForeignKey(Bill, on_delete=models.SET_NULL,
                                       null=True, blank=True, related_name='payments')
    amount         = models.DecimalField(max_digits=15, decimal_places=2)
    payment_date   = models.DateField()
    reference      = models.CharField(max_length=100, blank=True)
    notes          = models.TextField(blank=True)
    recorded_by    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-payment_date']

    def __str__(self):
        return f'{self.get_payment_type_display()} — KES {self.amount} on {self.payment_date}'

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)
        if self.invoice_id:
            inv = Invoice.objects.get(pk=self.invoice_id)
            inv.amount_paid = sum(p.amount for p in inv.payments.all())
            inv.balance_due = inv.total_amount - inv.amount_paid
            if inv.balance_due <= 0:
                inv.status = Invoice.Status.PAID
            elif inv.amount_paid > 0:
                inv.status = Invoice.Status.PARTIAL
            inv.save(update_fields=['amount_paid', 'balance_due', 'status'])
        if self.bill_id:
            bill = Bill.objects.get(pk=self.bill_id)
            bill.amount_paid = sum(p.amount for p in bill.payments.all())
            bill.balance_due = bill.total_amount - bill.amount_paid - bill.withholding_tax
            if bill.balance_due <= 0:
                bill.status = Bill.Status.PAID
            elif bill.amount_paid > 0:
                bill.status = Bill.Status.PARTIAL
            bill.save(update_fields=['amount_paid', 'balance_due', 'status'])


# ── Expense Claims ─────────────────────────────────────────────────────────────

class ExpenseClaim(models.Model):
    class Status(models.TextChoices):
        DRAFT    = 'draft',    'Draft'
        SUBMITTED = 'submitted', 'Submitted'
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        PAID     = 'paid',     'Paid'

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference   = models.CharField(max_length=20, unique=True, blank=True)
    title       = models.CharField(max_length=255)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                     related_name='expense_claims')
    project     = models.ForeignKey('projects.Project', on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='expense_claims')
    status      = models.CharField(max_length=15, choices=Status.choices, default=Status.DRAFT)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes       = models.TextField(blank=True)

    reviewed_by  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='expenses_reviewed')
    reviewed_at  = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)

    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.reference} — {self.title}'

    def save(self, *args, **kwargs):
        if not self.reference:
            from datetime import date
            year = date.today().year
            count = ExpenseClaim.objects.filter(reference__startswith=f'EXP-{year}-').count()
            self.reference = f'EXP-{year}-{str(count + 1).zfill(4)}'
        super().save(*args, **kwargs)

    def recalculate(self):
        self.total_amount = sum(item.amount for item in self.items.all())
        self.save(update_fields=['total_amount'])


class ExpenseClaimItem(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    claim       = models.ForeignKey(ExpenseClaim, on_delete=models.CASCADE, related_name='items')
    date        = models.DateField()
    description = models.CharField(max_length=255)
    category    = models.CharField(max_length=20, choices=Account.CostCode.choices,
                                   default=Account.CostCode.OTHER)
    amount      = models.DecimalField(max_digits=15, decimal_places=2)
    receipt_ref = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f'{self.description} — KES {self.amount}'
