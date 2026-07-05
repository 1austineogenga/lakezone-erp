import logging
from django.core.mail import send_mail
from django.conf import settings
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Notification

logger = logging.getLogger(__name__)


# ── Email helper ──────────────────────────────────────────────────────────────

def send_notification_email(user, subject, message):
    """Send an email to a user. Fails gracefully."""
    if not user or not user.email:
        return
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@lakezone.ke"),
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception as exc:
        logger.error("Failed to send notification email to %s: %s", user.email, exc)


# ── Internal helper ───────────────────────────────────────────────────────────

def notify(recipient, type_, title, message, link=""):
    """Create a Notification record, dispatch an email, and send push."""
    if not recipient:
        return
    Notification.objects.create(
        recipient=recipient, type=type_, title=title, message=message, link=link
    )
    send_notification_email(recipient, title, message)
    try:
        from .models import DeviceToken
        from .push import send_push
        tokens = list(DeviceToken.objects.filter(user=recipient).values_list("token", flat=True))
        send_push(tokens, title, message, link)
    except Exception as exc:
        logger.error("Push notification failed for %s: %s", recipient, exc)


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


@receiver(post_save, sender="procurement.PurchaseOrder")
def po_created(sender, instance, created, **kwargs):
    if not created:
        return
    from core.models import User
    procurement_team = User.objects.filter(role="procurement_officer")
    po_link = f"/procurement/po/{instance.id}"
    for user in procurement_team:
        notify(
            user,
            Notification.Type.GENERAL,
            f"New Purchase Order {instance.po_number}",
            f"A new purchase order {instance.po_number} has been created.",
            po_link,
        )


# ── HR Leave signals ──────────────────────────────────────────────────────────

@receiver(post_save, sender="hr.LeaveApplication")
def leave_status_changed(sender, instance, created, **kwargs):
    if created:
        return
    employee_user = instance.employee.user if instance.employee else None
    leave_link = f"/hr/leave/{instance.id}"

    if instance.status == "approved":
        notify(
            employee_user,
            Notification.Type.GENERAL,
            f"Leave Application {instance.reference} Approved",
            f"Your leave application {instance.reference} from {instance.start_date} to {instance.end_date} has been approved.",
            leave_link,
        )
    elif instance.status == "rejected":
        notify(
            employee_user,
            Notification.Type.GENERAL,
            f"Leave Application {instance.reference} Rejected",
            f"Your leave application {instance.reference} has been rejected.",
            leave_link,
        )


@receiver(post_save, sender="hr.PayrollEntry")
def payroll_entry_approved(sender, instance, created, **kwargs):
    if created:
        return
    period = getattr(instance, "period", None)
    if not (period and getattr(period, "status", None) == "approved"):
        return
    employee_user = instance.employee.user if instance.employee else None
    notify(
        employee_user,
        Notification.Type.GENERAL,
        "Payroll Approved",
        f"Your payroll for {period.name} (net pay: {instance.net_pay}) has been approved.",
        f"/hr/payroll/{instance.id}",
    )


# ── Finance signals ───────────────────────────────────────────────────────────

@receiver(post_save, sender="finance.Invoice")
def invoice_created(sender, instance, created, **kwargs):
    if not created:
        return
    from core.models import User
    finance_team = User.objects.filter(role__in=["finance_officer", "finance_manager"])
    inv_link = f"/finance/invoices/{instance.id}"
    for user in finance_team:
        notify(
            user,
            Notification.Type.GENERAL,
            f"New Invoice {instance.invoice_number}",
            f"Invoice {instance.invoice_number} has been created.",
            inv_link,
        )


@receiver(post_save, sender="finance.Invoice")
def invoice_payment_received(sender, instance, created, **kwargs):
    if created:
        return
    if instance.status in ("paid", "partial"):
        from core.models import User
        finance_team = User.objects.filter(role__in=["finance_officer", "finance_manager"])
        inv_link = f"/finance/invoices/{instance.id}"
        label = "Fully Paid" if instance.status == "paid" else "Partially Paid"
        for user in finance_team:
            notify(
                user,
                Notification.Type.GENERAL,
                f"Invoice {instance.invoice_number} — {label}",
                f"Invoice {instance.invoice_number} is now marked as {label.lower()}.",
                inv_link,
            )


# ── Projects IPC signals ──────────────────────────────────────────────────────

@receiver(post_save, sender="finance.PaymentCertificate")
def ipc_status_changed(sender, instance, created, **kwargs):
    if created:
        return
    project = instance.project
    if not project:
        return
    # Notify project managers
    from core.models import User
    pms = User.objects.filter(role="project_manager")
    ipc_link = f"/projects/{project.id}/ipc/{instance.id}"
    for user in pms:
        notify(
            user,
            Notification.Type.IPC_ISSUED,
            f"IPC {instance.certificate_number} Status Changed",
            f"IPC {instance.certificate_number} for project {project.name} is now {instance.get_status_display()}.",
            ipc_link,
        )


# ── Finance expense claim signals ────────────────────────────────────────────

@receiver(post_save, sender="finance.ExpenseClaim")
def expense_claim_status_changed(sender, instance, created, **kwargs):
    from core.models import User
    claim_link = f"/finance/expenses"

    # Notify finance team when a claim is submitted for review
    if instance.status == "submitted":
        submitter_name = instance.submitted_by.get_full_name() or instance.submitted_by.email
        finance_team = User.objects.filter(role__in=["finance_officer", "finance_manager", "system_admin"])
        for user in finance_team:
            if user == instance.submitted_by:
                continue
            notify(
                user,
                Notification.Type.EXPENSE_SUBMITTED,
                f"Expense Claim {instance.reference} Submitted",
                f"{submitter_name} submitted expense claim '{instance.title}' "
                f"for KES {instance.total_amount:,.0f} — awaiting your review.",
                claim_link,
            )

    # Notify the claimant when approved or rejected
    elif instance.status == "approved" and not created:
        notify(
            instance.submitted_by,
            Notification.Type.EXPENSE_APPROVED,
            f"Expense Claim {instance.reference} Approved",
            f"Your expense claim '{instance.title}' (KES {instance.total_amount:,.0f}) has been approved.",
            claim_link,
        )
    elif instance.status == "rejected" and not created:
        review_note = f" Reason: {instance.review_notes}" if instance.review_notes else ""
        notify(
            instance.submitted_by,
            Notification.Type.EXPENSE_REJECTED,
            f"Expense Claim {instance.reference} Rejected",
            f"Your expense claim '{instance.title}' has been rejected.{review_note}",
            claim_link,
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
