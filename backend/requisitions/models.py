from django.db import models
from django.core.exceptions import ValidationError
import uuid
from django.conf import settings
from datetime import date


def generate_ref():
    year = date.today().year
    last = StaffRequisition.objects.filter(
        reference_number__startswith=f'REQ-{year}-'
    ).count()
    return f'REQ-{year}-{str(last + 1).zfill(4)}'


class StaffRequisition(models.Model):
    class ReqType(models.TextChoices):
        FUEL               = 'fuel',               'Fuel Requisition'
        MATERIALS          = 'materials',           'Materials Requisition'
        REPAIR_MAINTENANCE = 'repair_maintenance',  'Repair & Maintenance'
        GENERAL_PURCHASE   = 'general_purchase',    'General Purchase'
        # Legacy types retained for backward compatibility
        STORE_ITEM         = 'store_item',          'Store Item'
        EXTERNAL_PURCHASE  = 'external_purchase',   'External Purchase'
        SERVICE            = 'service',             'Service Request'

    class Status(models.TextChoices):
        DRAFT     = 'draft',       'Draft'
        SUBMITTED = 'submitted',   'Submitted'
        APPROVED  = 'approved',    'Approved'
        REJECTED  = 'rejected',    'Rejected'
        FULFILLED = 'fulfilled',   'Fulfilled'
        # Legacy statuses retained for backward compatibility
        DEPT_REVIEW = 'dept_review', 'Department Review'
        FINANCE     = 'finance',     'Finance Review'
        MD_REVIEW   = 'md_review',   'MD Review'

    class Priority(models.TextChoices):
        LOW    = 'low',    'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH   = 'high',   'High'
        URGENT = 'urgent', 'Urgent'

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reference_number = models.CharField(max_length=20, unique=True, blank=True)
    title            = models.CharField(max_length=255)
    req_type         = models.CharField(max_length=20, choices=ReqType.choices)
    status           = models.CharField(max_length=20, choices=Status.choices, default=Status.SUBMITTED)
    priority         = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)

    requested_by  = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                      related_name='requisitions_made')
    department    = models.ForeignKey('core.Department', on_delete=models.SET_NULL,
                                      null=True, blank=True)
    project       = models.ForeignKey('projects.Project', on_delete=models.SET_NULL,
                                      null=True, blank=True)

    description      = models.TextField(blank=True)
    date_required    = models.DateField()
    total_amount     = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    rejection_reason = models.TextField(blank=True)

    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    # Payment details (fuel, materials, general_purchase)
    PAYMENT_METHOD_CHOICES = [
        ('mpesa_paybill', 'M-Pesa Paybill'),
        ('mpesa_till', 'M-Pesa Till'),
        ('bank_transfer', 'Bank Transfer'),
    ]
    payment_method          = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, blank=True)
    payment_business_number = models.CharField(max_length=50, blank=True, help_text='M-Pesa Paybill business number')
    payment_account_number  = models.CharField(max_length=100, blank=True, help_text='M-Pesa Paybill account / bank account number')
    payment_till_number     = models.CharField(max_length=50, blank=True, help_text='M-Pesa Till number')
    payment_bank_name       = models.CharField(max_length=100, blank=True)
    payment_account_name    = models.CharField(max_length=100, blank=True)
    payment_branch_name     = models.CharField(max_length=100, blank=True)

    fulfilled_by      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                          null=True, blank=True, related_name='requisitions_fulfilled')
    fulfilled_at      = models.DateTimeField(null=True, blank=True)
    fulfillment_notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.reference_number} — {self.title}'

    def save(self, *args, **kwargs):
        if not self.reference_number:
            self.reference_number = generate_ref()
        super().save(*args, **kwargs)

    def recalculate_total(self):
        self.total_amount = sum(
            item.quantity * item.unit_price for item in self.items.all()
        )
        self.save(update_fields=['total_amount'])


class RequisitionItem(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.ForeignKey(StaffRequisition, on_delete=models.CASCADE, related_name='items')
    description = models.CharField(max_length=255)
    quantity    = models.DecimalField(max_digits=10, decimal_places=2)
    unit        = models.CharField(max_length=50, blank=True)
    unit_price  = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    total_price = models.DecimalField(max_digits=15, decimal_places=2, default=0)
    stock_item  = models.ForeignKey('inventory.StockItem', on_delete=models.SET_NULL,
                                    null=True, blank=True)
    notes       = models.TextField(blank=True)

    def clean(self):
        if self.quantity is not None and self.quantity <= 0:
            raise ValidationError({'quantity': 'Quantity must be greater than 0.'})
        if self.unit_price is not None and self.unit_price < 0:
            raise ValidationError({'unit_price': 'Unit price must be >= 0.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        self.total_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.description} x{self.quantity}'


class RequisitionApproval(models.Model):
    class Action(models.TextChoices):
        APPROVED = 'approved', 'Approved'
        REJECTED = 'rejected', 'Rejected'
        RETURNED = 'returned', 'Returned for Revision'

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.ForeignKey(StaffRequisition, on_delete=models.CASCADE, related_name='approvals')
    stage       = models.CharField(max_length=20, choices=StaffRequisition.Status.choices)
    action      = models.CharField(max_length=10, choices=Action.choices)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    comments    = models.TextField(blank=True)
    actioned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['actioned_at']

    def __str__(self):
        return f'{self.requisition.reference_number} — {self.stage} — {self.action}'


class MaintenanceSchedule(models.Model):
    """Logged by site manager or admin after a repair/maintenance requisition is submitted."""

    class Status(models.TextChoices):
        LOGGED           = 'logged',           'Logged'
        PENDING_APPROVAL = 'pending_approval', 'Pending Admin Approval'
        APPROVED         = 'approved',         'Approved'
        IN_PROGRESS      = 'in_progress',      'In Progress'
        COMPLETED        = 'completed',        'Completed'
        CANCELLED        = 'cancelled',        'Cancelled'

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition      = models.OneToOneField(StaffRequisition, on_delete=models.CASCADE,
                                            related_name='maintenance_schedule')
    assigned_to      = models.CharField(max_length=255, blank=True)
    work_description = models.TextField(blank=True)
    notes            = models.TextField(blank=True)
    scheduled_date   = models.DateField(null=True, blank=True)
    payment_amount   = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    payment_details  = models.TextField(blank=True)
    status           = models.CharField(max_length=20, choices=Status.choices, default=Status.LOGGED)

    logged_by        = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
                                         related_name='maintenance_schedules_logged')
    admin_comments   = models.TextField(blank=True)
    approved_by      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                         null=True, blank=True,
                                         related_name='maintenance_schedules_approved')
    approved_at      = models.DateTimeField(null=True, blank=True)
    expense_claim    = models.ForeignKey('finance.ExpenseClaim', on_delete=models.SET_NULL,
                                         null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Schedule for {self.requisition.reference_number}'


class FuelPaymentRecord(models.Model):
    """Finance records how a fuel requisition was paid."""

    class PaymentMode(models.TextChoices):
        FINANCE_RAISED = 'finance_raised', 'Payment Raised by Finance'
        MD_PAID        = 'md_paid',        'MD Paid Directly (Record Update)'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition  = models.OneToOneField(StaffRequisition, on_delete=models.CASCADE,
                                        related_name='fuel_payment')
    payment_mode = models.CharField(max_length=20, choices=PaymentMode.choices)
    amount_paid  = models.DecimalField(max_digits=15, decimal_places=2)
    payment_ref  = models.CharField(max_length=100, blank=True)
    notes        = models.TextField(blank=True)
    expense_claim = models.ForeignKey('finance.ExpenseClaim', on_delete=models.SET_NULL,
                                      null=True, blank=True)
    created_by   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    created_at   = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Fuel payment for {self.requisition.reference_number}'
