from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone


@receiver(post_save, sender='requisitions.StaffRequisition')
def create_expense_claim_on_approval(sender, instance, created, **kwargs):
    """
    When a StaffRequisition transitions to 'approved', automatically create
    a corresponding ExpenseClaim (and its items) in the finance module.
    """
    if instance.status != 'approved':
        return

    from finance.models import ExpenseClaim, ExpenseClaimItem

    # Avoid duplicates: if an ExpenseClaim is already linked to this requisition, skip.
    if ExpenseClaim.objects.filter(requisition=instance).exists():
        return

    claim = ExpenseClaim.objects.create(
        title=instance.title,
        submitted_by=instance.requested_by,
        project=instance.project,
        total_amount=instance.total_amount,
        notes=f"Auto-created from requisition {instance.reference_number}",
        status='submitted',
        requisition=instance,
    )

    today = timezone.localdate()
    for item in instance.items.all():
        ExpenseClaimItem.objects.create(
            claim=claim,
            date=today,
            description=item.description,
            amount=item.total_price,
            category='other',
            receipt_ref=instance.reference_number,
        )
