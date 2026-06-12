from django.db import models
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
        STORE_ITEM        = 'store_item',         'Store Item'
        EXTERNAL_PURCHASE = 'external_purchase',  'External Purchase'
        SERVICE           = 'service',            'Service Request'

    class Status(models.TextChoices):
        DRAFT       = 'draft',       'Draft'
        SUBMITTED   = 'submitted',   'Submitted'
        DEPT_REVIEW = 'dept_review', 'Department Review'
        FINANCE     = 'finance',     'Finance Review'
        MD_REVIEW   = 'md_review',   'MD Review'
        APPROVED    = 'approved',    'Approved'
        REJECTED    = 'rejected',    'Rejected'
        FULFILLED   = 'fulfilled',   'Fulfilled'

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

    description   = models.TextField(blank=True)
    date_required = models.DateField()
    total_amount  = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    fulfilled_by     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                         null=True, blank=True, related_name='requisitions_fulfilled')
    fulfilled_at     = models.DateTimeField(null=True, blank=True)
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

    def save(self, *args, **kwargs):
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
