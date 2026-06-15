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
        DRAFT    = 'draft',    'Draft'
        POSTED   = 'posted',   'Posted'
        REVERSED = 'reversed', 'Reversed'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference    = models.CharField(max_length=30, unique=True, blank=True)
    entry_type   = models.CharField(max_length=20, choices=EntryType.choices,
                                    default=EntryType.MANUAL)
    entry_date   = models.DateField()
    period       = models.CharField(max_length=7, blank=True)  # YYYY-MM
    description  = models.CharField(max_length=500)
    project      = models.ForeignKey('projects.Project', on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='journal_entries')
    status       = models.CharField(max_length=15, choices=Status.choices, default=Status.DRAFT)
    is_reversing = models.BooleanField(default=False)
    reversal_of  = models.ForeignKey('self', on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='reversal')
    created_by   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                     related_name='journal_entries_created')
    posted_by    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                     null=True, blank=True, related_name='journal_entries_posted')
    posted_at    = models.DateTimeField(null=True, blank=True)
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
