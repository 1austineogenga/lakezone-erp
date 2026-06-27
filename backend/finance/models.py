import uuid
from datetime import date
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
    is_reconciled = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   related_name='invoices_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-issue_date']

    def __str__(self):
        return f'{self.invoice_number} — {self.client}'

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.due_date and self.issue_date and self.due_date < self.issue_date:
            raise ValidationError({'due_date': 'Due date must be on or after issue date.'})

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
    is_reconciled = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                   related_name='bills_created')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-issue_date']

    def __str__(self):
        return f'{self.bill_number} — {self.supplier}'

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.due_date and self.issue_date and self.due_date < self.issue_date:
            raise ValidationError({'due_date': 'Due date must be on or after issue date.'})

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

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.amount is not None and self.amount <= 0:
            raise ValidationError({'amount': 'Payment amount must be greater than zero.'})

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
    requisition = models.ForeignKey('requisitions.StaffRequisition', on_delete=models.SET_NULL,
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


# ── Retention Releases ─────────────────────────────────────────────────────────

class RetentionRelease(models.Model):
    class RetentionType(models.TextChoices):
        RECEIVABLE = 'receivable', 'Receivable (Client owes us)'
        PAYABLE    = 'payable',    'Payable (We owe subcontractor)'

    class Status(models.TextChoices):
        PENDING  = 'pending',  'Pending Release'
        RELEASED = 'released', 'Released'
        PAID     = 'paid',     'Paid'

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    retention_type   = models.CharField(max_length=15, choices=RetentionType.choices)
    invoice          = models.ForeignKey(Invoice, on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='retention_releases')
    bill             = models.ForeignKey(Bill, on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='retention_releases')
    project          = models.ForeignKey('projects.Project', on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='retention_releases')
    amount           = models.DecimalField(max_digits=15, decimal_places=2)
    release_date     = models.DateField()
    status           = models.CharField(max_length=15, choices=Status.choices,
                                        default=Status.PENDING)
    notes            = models.TextField(blank=True)
    released_by      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                         null=True, blank=True, related_name='retentions_released')
    released_at      = models.DateTimeField(null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['release_date']

    def __str__(self):
        src = self.invoice or self.bill
        return f'{self.get_retention_type_display()} — KES {self.amount} ({self.status})'


# ── Project Budget (Budget vs Actual) ─────────────────────────────────────────

class ProjectBudget(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project     = models.ForeignKey('projects.Project', on_delete=models.CASCADE,
                                    related_name='finance_budgets')
    cost_code   = models.CharField(max_length=20, choices=Account.CostCode.choices)
    description = models.CharField(max_length=255, blank=True)
    budgeted_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes       = models.TextField(blank=True)
    created_by  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                    related_name='budgets_created')
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['project', 'cost_code']
        unique_together = ['project', 'cost_code']

    def __str__(self):
        return f'{self.project} / {self.cost_code} — KES {self.budgeted_amount}'


# ── Payment Certificate (Architect/Engineer IPC Certification) ─────────────────

class PaymentCertificate(models.Model):
    class Status(models.TextChoices):
        DRAFT    = 'draft',    'Draft'
        ISSUED   = 'issued',   'Issued'
        APPROVED = 'approved', 'Approved'
        PAID     = 'paid',     'Paid'

    id                 = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    certificate_number = models.CharField(max_length=30, unique=True, blank=True)
    invoice            = models.ForeignKey(Invoice, on_delete=models.SET_NULL,
                                           null=True, blank=True, related_name='certificates')
    project            = models.ForeignKey('projects.Project', on_delete=models.SET_NULL,
                                           null=True, blank=True, related_name='certificates')
    certified_by       = models.CharField(max_length=255)  # Architect / Quantity Surveyor name
    certificate_date   = models.DateField()
    period_from        = models.DateField(null=True, blank=True)
    period_to          = models.DateField(null=True, blank=True)
    contract_value     = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    work_done_to_date  = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    previous_certified = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    certified_amount   = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    retention_held     = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    net_payment_due    = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    status             = models.CharField(max_length=15, choices=Status.choices, default=Status.DRAFT)
    notes              = models.TextField(blank=True)
    created_by         = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                           related_name='certificates_created')
    created_at         = models.DateTimeField(auto_now_add=True)
    updated_at         = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-certificate_date']

    def save(self, *args, **kwargs):
        if not self.certificate_number:
            from datetime import date
            year = date.today().year
            count = PaymentCertificate.objects.filter(
                certificate_number__startswith=f'IPC-{year}-').count()
            self.certificate_number = f'IPC-{year}-{str(count + 1).zfill(4)}'
        self.certified_amount  = self.work_done_to_date - self.previous_certified
        self.net_payment_due   = self.certified_amount - self.retention_held
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.certificate_number} — {self.project}'


# ── Performance Bonds & Bank Guarantees ────────────────────────────────────────

class PerformanceBond(models.Model):
    class BondType(models.TextChoices):
        PERFORMANCE  = 'performance',  'Performance Bond'
        ADVANCE      = 'advance',      'Advance Payment Guarantee'
        RETENTION    = 'retention',    'Retention Bond'
        BID          = 'bid',          'Bid Bond / Tender Security'
        MAINTENANCE  = 'maintenance',  'Maintenance Bond'
        OTHER        = 'other',        'Other'

    class Status(models.TextChoices):
        ACTIVE   = 'active',   'Active'
        EXPIRING = 'expiring', 'Expiring Soon (30 days)'
        EXPIRED  = 'expired',  'Expired'
        RELEASED = 'released', 'Released'
        CALLED   = 'called',   'Called / Claimed'

    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bond_type     = models.CharField(max_length=20, choices=BondType.choices)
    reference     = models.CharField(max_length=100, blank=True)
    project       = models.ForeignKey('projects.Project', on_delete=models.SET_NULL,
                                      null=True, blank=True, related_name='bonds')
    issuing_bank  = models.CharField(max_length=255)
    beneficiary   = models.CharField(max_length=255)
    amount        = models.DecimalField(max_digits=15, decimal_places=2)
    issue_date    = models.DateField()
    expiry_date   = models.DateField()
    status        = models.CharField(max_length=15, choices=Status.choices, default=Status.ACTIVE)
    notes         = models.TextField(blank=True)
    created_by    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                      related_name='bonds_created')
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['expiry_date']

    def save(self, *args, **kwargs):
        today = date.today()
        if self.status not in (self.Status.RELEASED, self.Status.CALLED):
            if self.expiry_date < today:
                self.status = self.Status.EXPIRED
            elif (self.expiry_date - today).days <= 30:
                self.status = self.Status.EXPIRING
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.get_bond_type_display()} — {self.issuing_bank} — KES {self.amount}'


# ── Payroll Cost Allocation (Timesheets) ───────────────────────────────────────

class Timesheet(models.Model):
    class Status(models.TextChoices):
        DRAFT     = 'draft',     'Draft'
        SUBMITTED = 'submitted', 'Submitted'
        APPROVED  = 'approved',  'Approved'
        REJECTED  = 'rejected',  'Rejected'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference    = models.CharField(max_length=20, unique=True, blank=True)
    employee     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                     related_name='timesheets')
    week_start   = models.DateField()  # Monday of the week
    status       = models.CharField(max_length=15, choices=Status.choices, default=Status.DRAFT)
    total_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    notes        = models.TextField(blank=True)
    reviewed_by  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='timesheets_reviewed')
    reviewed_at  = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-week_start']

    def save(self, *args, **kwargs):
        if not self.reference:
            from datetime import date as d
            year = d.today().year
            count = Timesheet.objects.filter(reference__startswith=f'TS-{year}-').count()
            self.reference = f'TS-{year}-{str(count + 1).zfill(4)}'
        super().save(*args, **kwargs)

    def recalculate(self):
        self.total_amount = sum(line.amount for line in self.lines.all())
        self.save(update_fields=['total_amount'])

    def __str__(self):
        return f'{self.reference} — {self.employee} w/e {self.week_start}'


class TimesheetLine(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timesheet   = models.ForeignKey(Timesheet, on_delete=models.CASCADE, related_name='lines')
    work_date   = models.DateField()
    project     = models.ForeignKey('projects.Project', on_delete=models.SET_NULL,
                                    null=True, blank=True, related_name='timesheet_lines')
    cost_code   = models.CharField(max_length=20, choices=Account.CostCode.choices,
                                   default=Account.CostCode.LABOUR)
    description = models.CharField(max_length=255)
    hours       = models.DecimalField(max_digits=5, decimal_places=2)
    hourly_rate = models.DecimalField(max_digits=12, decimal_places=2)
    amount      = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    def save(self, *args, **kwargs):
        self.amount = self.hours * self.hourly_rate
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.work_date} — {self.project} — {self.hours}hrs'


# ── General Ledger Journal ─────────────────────────────────────────────────────

class JournalEntry(models.Model):
    class EntryType(models.TextChoices):
        MANUAL     = 'manual',     'Manual Journal'
        INVOICE    = 'invoice',    'Invoice (AR)'
        PAYMENT    = 'payment',    'Payment Receipt'
        BILL       = 'bill',       'Supplier Bill (AP)'
        EXPENSE    = 'expense',    'Expense Claim'
        PAYROLL    = 'payroll',    'Payroll Allocation'
        ADJUSTMENT = 'adjustment', 'Adjustment'
        PERIOD_CLOSE = 'period_close', 'Period-End Close'

    class Status(models.TextChoices):
        DRAFT            = 'draft',            'Draft'
        PENDING_APPROVAL = 'pending_approval', 'Pending Approval'
        APPROVED         = 'approved',         'Approved'
        REJECTED         = 'rejected',         'Rejected'
        POSTED           = 'posted',           'Posted'
        REVERSED         = 'reversed',         'Reversed'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference    = models.CharField(max_length=30, unique=True, blank=True)
    entry_type   = models.CharField(max_length=20, choices=EntryType.choices,
                                    default=EntryType.MANUAL)
    entry_date   = models.DateField()
    period       = models.CharField(max_length=7, blank=True)  # YYYY-MM
    description  = models.CharField(max_length=500)
    project      = models.ForeignKey('projects.Project', on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='journal_entries')
    status       = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    is_reversing = models.BooleanField(default=False)
    source       = models.CharField(max_length=20, default='manual', blank=True)
    reversal_of  = models.ForeignKey('self', on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='reversal')
    created_by   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                     related_name='journal_entries_created')
    posted_by    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='journal_entries_posted')
    posted_at    = models.DateTimeField(null=True, blank=True)
    approved_by  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='journal_entries_approved')
    approved_at  = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-entry_date', '-created_at']

    def save(self, *args, **kwargs):
        if not self.reference:
            from datetime import date as d
            year = d.today().year
            count = JournalEntry.objects.filter(reference__startswith=f'JNL-{year}-').count()
            self.reference = f'JNL-{year}-{str(count + 1).zfill(4)}'
        if not self.period and self.entry_date:
            self.period = self.entry_date.strftime('%Y-%m')
        super().save(*args, **kwargs)

    @property
    def total_debits(self):
        return sum(l.debit for l in self.lines.all())

    @property
    def total_credits(self):
        return sum(l.credit for l in self.lines.all())

    @property
    def is_balanced(self):
        return abs(self.total_debits - self.total_credits) < 0.01

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.status == self.Status.POSTED and not self.is_balanced:
            raise ValidationError(
                f'Cannot post an unbalanced journal entry. '
                f'Debits={self.total_debits}, Credits={self.total_credits}.'
            )

    def __str__(self):
        return f'{self.reference} — {self.description}'


class JournalLine(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    journal     = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    account     = models.ForeignKey(Account, on_delete=models.PROTECT, related_name='journal_lines')
    description = models.CharField(max_length=255, blank=True)
    debit       = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    credit      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    project     = models.ForeignKey('projects.Project', on_delete=models.SET_NULL,
                                    null=True, blank=True)
    cost_code   = models.CharField(max_length=20, choices=Account.CostCode.choices, blank=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f'{self.account} Dr {self.debit} / Cr {self.credit}'


# ── QuickBooks Integration ─────────────────────────────────────────────────────

class QuickBooksConfig(models.Model):
    """Stores OAuth 2.0 credentials and company info for QuickBooks Online."""
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client_id           = models.CharField(max_length=255)
    client_secret       = models.CharField(max_length=255)
    environment         = models.CharField(max_length=10, choices=[('sandbox','Sandbox'),('production','Production')], default='sandbox')
    realm_id            = models.CharField(max_length=50, blank=True, help_text='QuickBooks Company ID')
    access_token        = models.TextField(blank=True)
    refresh_token       = models.TextField(blank=True)
    token_expiry        = models.DateTimeField(null=True, blank=True)
    redirect_uri        = models.CharField(max_length=500, blank=True)
    is_connected        = models.BooleanField(default=False)
    last_sync_at        = models.DateTimeField(null=True, blank=True)
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'QuickBooks Config'

    def __str__(self):
        return f'QuickBooks ({self.environment}) — {"Connected" if self.is_connected else "Disconnected"}'


class QBSyncLog(models.Model):
    """Records each sync operation with QuickBooks."""
    class Direction(models.TextChoices):
        PUSH = 'push', 'Push to QB'
        PULL = 'pull', 'Pull from QB'

    class SyncStatus(models.TextChoices):
        SUCCESS = 'success', 'Success'
        PARTIAL = 'partial', 'Partial'
        FAILED  = 'failed',  'Failed'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entity_type  = models.CharField(max_length=50)
    direction    = models.CharField(max_length=10, choices=Direction.choices)
    status       = models.CharField(max_length=10, choices=SyncStatus.choices)
    records_ok   = models.IntegerField(default=0)
    records_fail = models.IntegerField(default=0)
    error_detail = models.TextField(blank=True)
    triggered_by = models.ForeignKey('core.User', on_delete=models.SET_NULL, null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.entity_type} {self.direction} — {self.status} @ {self.created_at:%Y-%m-%d %H:%M}'


# ── Bank Transaction (imported from QB) ───────────────────────────────────────

class BankTransaction(models.Model):
    class TxnType(models.TextChoices):
        DEPOSIT    = 'deposit',    'Deposit'
        WITHDRAWAL = 'withdrawal', 'Withdrawal'
        TRANSFER   = 'transfer',   'Transfer'
        OTHER      = 'other',      'Other'

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference      = models.CharField(max_length=100, unique=True)
    txn_date       = models.DateField()
    txn_type       = models.CharField(max_length=15, choices=TxnType.choices, default=TxnType.OTHER)
    account        = models.ForeignKey(Account, on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name='bank_transactions')
    amount         = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    description    = models.TextField(blank=True)
    payee          = models.CharField(max_length=255, blank=True)
    source         = models.CharField(max_length=20, default='manual', blank=True)
    created_by     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                       related_name='bank_transactions_created')
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-txn_date']

    def __str__(self):
        return f'{self.reference} — {self.txn_type} {self.amount}'


# ── Credit Memo / Vendor Credit (imported from QB) ────────────────────────────

class CreditNote(models.Model):
    class CreditType(models.TextChoices):
        AR = 'ar', 'Credit Memo (Client)'
        AP = 'ap', 'Vendor Credit (Supplier)'

    class Status(models.TextChoices):
        OPEN   = 'open',   'Open'
        APPLIED = 'applied', 'Applied'
        VOIDED = 'voided', 'Voided'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference    = models.CharField(max_length=50, unique=True)
    credit_type  = models.CharField(max_length=5, choices=CreditType.choices)
    txn_date     = models.DateField()
    client       = models.ForeignKey('crm.Client', on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='credit_notes')
    supplier     = models.ForeignKey('procurement.Supplier', on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='credit_notes')
    amount       = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    balance      = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    memo         = models.TextField(blank=True)
    status       = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    source       = models.CharField(max_length=20, default='manual', blank=True)
    created_by   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                     related_name='credit_notes_created')
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-txn_date']

    def __str__(self):
        party = self.client or self.supplier
        return f'{self.reference} — {party} — KES {self.amount}'


# ── Bank Reconciliation ────────────────────────────────────────────────────────

class BankReconciliation(models.Model):
    class Status(models.TextChoices):
        OPEN   = 'open',   'Open'
        CLOSED = 'closed', 'Closed'

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    account          = models.ForeignKey(Account, on_delete=models.PROTECT,
                                         related_name='reconciliations',
                                         limit_choices_to={'account_type': 'asset'})
    statement_date   = models.DateField()
    statement_balance = models.DecimalField(max_digits=15, decimal_places=2)
    reconciled_balance = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    difference       = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    status           = models.CharField(max_length=10, choices=Status.choices, default=Status.OPEN)
    notes            = models.TextField(blank=True)
    reconciled_by    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                         related_name='bank_reconciliations')
    reconciled_at    = models.DateTimeField(null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-statement_date']

    def __str__(self):
        return f'Reconciliation {self.account} — {self.statement_date} ({self.status})'

    def save(self, *args, **kwargs):
        self.difference = self.statement_balance - self.reconciled_balance
        super().save(*args, **kwargs)


class BankReconciliationLine(models.Model):
    """Links a BankTransaction to a reconciliation and marks it as cleared."""
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reconciliation  = models.ForeignKey(BankReconciliation, on_delete=models.CASCADE,
                                        related_name='lines')
    transaction     = models.ForeignKey(BankTransaction, on_delete=models.PROTECT,
                                        related_name='reconciliation_lines')
    is_cleared      = models.BooleanField(default=True)
    notes           = models.TextField(blank=True)

    def __str__(self):
        return f'{self.reconciliation} — {self.transaction.reference}'


# ── GL Auto-Journal Signals ────────────────────────────────────────────────────
# These signals create journal entries automatically when invoices, bills, or
# payments transition to key statuses (sent/approved/created).

def _get_or_create_system_account(code, name, account_type):
    """Return an Account by code, creating a placeholder if it doesn't exist."""
    obj, _ = Account.objects.get_or_create(
        code=code,
        defaults={'name': name, 'account_type': account_type},
    )
    return obj


def _create_gl_journal(entry_type, entry_date, description, project, source_ref, lines_data):
    """
    Create a JournalEntry + JournalLines from lines_data.
    lines_data: list of {'account': Account, 'debit': Decimal, 'credit': Decimal, 'description': str}
    The entry is created as DRAFT (auto-journals still require manual posting/approval).
    Uses the first superuser as created_by fallback.
    """
    from django.contrib.auth import get_user_model
    User = get_user_model()
    system_user = User.objects.filter(is_superuser=True).order_by('date_joined').first()
    if system_user is None:
        return  # No user to assign — skip silently (e.g. during initial data load)

    entry = JournalEntry.objects.create(
        entry_type=entry_type,
        entry_date=entry_date,
        description=description,
        project=project,
        source=source_ref,
        status=JournalEntry.Status.DRAFT,
        created_by=system_user,
    )
    for ld in lines_data:
        JournalLine.objects.create(
            journal=entry,
            account=ld['account'],
            description=ld.get('description', ''),
            debit=ld.get('debit', 0),
            credit=ld.get('credit', 0),
        )
    return entry


from django.db.models.signals import post_save
from django.dispatch import receiver
from decimal import Decimal


@receiver(post_save, sender=Invoice)
def gl_auto_journal_invoice(sender, instance, created, **kwargs):
    """
    When an Invoice is first sent (status=sent) or certified, create a GL entry:
      Dr Accounts Receivable (1200)
      Cr Revenue (4000)
    Only fires once per invoice (checked via existing journal with source=invoice_number).
    """
    if instance.status not in (Invoice.Status.SENT, Invoice.Status.CERTIFIED):
        return
    # Avoid duplicate journals
    if JournalEntry.objects.filter(source=instance.invoice_number,
                                   entry_type=JournalEntry.EntryType.INVOICE).exists():
        return
    try:
        ar_account  = _get_or_create_system_account('1200', 'Accounts Receivable', Account.AccountType.ASSET)
        rev_account = _get_or_create_system_account('4000', 'Revenue',             Account.AccountType.REVENUE)
        amount = instance.total_amount or Decimal('0.00')
        _create_gl_journal(
            entry_type=JournalEntry.EntryType.INVOICE,
            entry_date=instance.issue_date,
            description=f'Invoice {instance.invoice_number} — {instance.client}',
            project=instance.project,
            source_ref=instance.invoice_number,
            lines_data=[
                {'account': ar_account,  'debit': amount,  'credit': Decimal('0.00'),
                 'description': f'AR — {instance.invoice_number}'},
                {'account': rev_account, 'debit': Decimal('0.00'), 'credit': amount,
                 'description': f'Revenue — {instance.invoice_number}'},
            ],
        )
    except Exception:
        pass  # Never block the invoice save


@receiver(post_save, sender=Bill)
def gl_auto_journal_bill(sender, instance, created, **kwargs):
    """
    When a Bill is approved, create a GL entry:
      Dr Expense (5000)
      Cr Accounts Payable (2000)
    """
    if instance.status != Bill.Status.APPROVED:
        return
    if JournalEntry.objects.filter(source=instance.bill_number,
                                   entry_type=JournalEntry.EntryType.BILL).exists():
        return
    try:
        exp_account = _get_or_create_system_account('5000', 'Cost of Sales / Expenses', Account.AccountType.EXPENSE)
        ap_account  = _get_or_create_system_account('2000', 'Accounts Payable',          Account.AccountType.LIABILITY)
        amount = instance.total_amount or Decimal('0.00')
        _create_gl_journal(
            entry_type=JournalEntry.EntryType.BILL,
            entry_date=instance.issue_date,
            description=f'Bill {instance.bill_number} — {instance.supplier}',
            project=instance.project,
            source_ref=instance.bill_number,
            lines_data=[
                {'account': exp_account, 'debit': amount,              'credit': Decimal('0.00'),
                 'description': f'Expense — {instance.bill_number}'},
                {'account': ap_account,  'debit': Decimal('0.00'), 'credit': amount,
                 'description': f'AP — {instance.bill_number}'},
            ],
        )
    except Exception:
        pass


@receiver(post_save, sender=Payment)
def gl_auto_journal_payment(sender, instance, created, **kwargs):
    """
    Receipt (from client):  Dr Bank/Cash (1100)  Cr Accounts Receivable (1200)
    Payment (to supplier):  Dr Accounts Payable (2000)  Cr Bank/Cash (1100)
    """
    if not created:
        return  # Only on first creation
    try:
        bank_account = _get_or_create_system_account('1100', 'Bank / Cash', Account.AccountType.ASSET)
        ar_account   = _get_or_create_system_account('1200', 'Accounts Receivable', Account.AccountType.ASSET)
        ap_account   = _get_or_create_system_account('2000', 'Accounts Payable',    Account.AccountType.LIABILITY)
        amount = instance.amount or Decimal('0.00')
        project = instance.invoice.project if instance.invoice else (
            instance.bill.project if instance.bill else None)
        ref = f'PMT-{instance.id}'

        if instance.payment_type == Payment.PaymentType.RECEIPT:
            lines_data = [
                {'account': bank_account, 'debit': amount,              'credit': Decimal('0.00'),
                 'description': f'Bank receipt — {instance.reference or ref}'},
                {'account': ar_account,   'debit': Decimal('0.00'), 'credit': amount,
                 'description': f'Clear AR — {instance.reference or ref}'},
            ]
        else:  # PAYMENT
            lines_data = [
                {'account': ap_account,   'debit': amount,              'credit': Decimal('0.00'),
                 'description': f'Clear AP — {instance.reference or ref}'},
                {'account': bank_account, 'debit': Decimal('0.00'), 'credit': amount,
                 'description': f'Bank payment — {instance.reference or ref}'},
            ]

        _create_gl_journal(
            entry_type=JournalEntry.EntryType.PAYMENT,
            entry_date=instance.payment_date,
            description=f'{instance.get_payment_type_display()} KES {amount} — {instance.reference or ref}',
            project=project,
            source_ref=ref,
            lines_data=lines_data,
        )
    except Exception:
        pass
