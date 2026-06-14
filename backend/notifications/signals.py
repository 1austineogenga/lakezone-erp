from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Notification


def notify(recipient, type_, title, message, link=""):
    if recipient:
        Notification.objects.create(
            recipient=recipient, type=type_, title=title, message=message, link=link
        )


# ── Procurement PR signals ────────────────────────────────────────────────────

@receiver(post_save, sender="procurement.PurchaseRequisition")
def pr_status_changed(sender, instance, created, **kwargs):
    if created:
        return
    requester = instance.requested_by
    pr_link = f"/procurement/pr/{instance.id}"

    if instance.status == "md_approved":
        notify(
            requester,
            Notification.Type.PR_APPROVED,
            f"PR {instance.pr_number} Fully Approved",
            f"Your purchase requisition {instance.pr_number} has been approved by the MD.",
            pr_link,
        )
    elif instance.status == "rejected":
        notify(
            requester,
            Notification.Type.PR_REJECTED,
            f"PR {instance.pr_number} Rejected",
            f"Your purchase requisition {instance.pr_number} has been rejected.",
            pr_link,
        )


# ── Inventory low-stock signals ───────────────────────────────────────────────

@receiver(post_save, sender="inventory.StockLevel")
def check_low_stock(sender, instance, **kwargs):
    item = instance.item
    reorder = float(item.reorder_level or 0)
    if reorder <= 0:
        return
    if float(instance.quantity_on_hand) <= reorder:
        from core.models import User
        admins = User.objects.filter(role__in=["system_admin", "storekeeper", "procurement_officer"])
        for admin in admins:
            Notification.objects.get_or_create(
                recipient=admin,
                type=Notification.Type.LOW_STOCK,
                title=f"Low Stock: {item.name}",
                is_read=False,
                defaults={
                    "message": f"{item.name} ({item.item_code}) is at {instance.quantity_on_hand} {item.unit} — below reorder level of {reorder}.",
                    "link": f"/inventory/{item.id}",
                },
            )
