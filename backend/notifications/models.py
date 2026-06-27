import uuid
from django.db import models
from django.conf import settings


class Notification(models.Model):
    class Type(models.TextChoices):
        PR_APPROVED          = "pr_approved",          "PR Approved"
        PR_REJECTED          = "pr_rejected",          "PR Rejected"
        PR_SUBMITTED         = "pr_submitted",         "PR Submitted for Approval"
        PO_APPROVED          = "po_approved",          "PO Approved"
        LOW_STOCK            = "low_stock",            "Low Stock Alert"
        TENDER_DUE           = "tender_due",           "Tender Deadline Soon"
        IPC_ISSUED           = "ipc_issued",           "IPC Issued"
        COMPLIANCE_EXPIRY    = "compliance_expiry",    "Compliance Expired"
        COMPLIANCE_WARNING   = "compliance_warning",   "Compliance Expiring Soon"
        GENERAL              = "general",              "General"

    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type    = models.CharField(max_length=30, choices=Type.choices, default=Type.GENERAL)
    title   = models.CharField(max_length=255)
    message = models.TextField()
    link    = models.CharField(max_length=500, blank=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.recipient} — {self.title}"


# ── Scheduled Actions ──────────────────────────────────────────────────────────

class ScheduledAction(models.Model):
    class Status(models.TextChoices):
        PENDING     = 'pending',     'Pending'
        IN_PROGRESS = 'in_progress', 'In Progress'
        COMPLETED   = 'completed',   'Completed'
        CANCELLED   = 'cancelled',   'Cancelled'

    class Priority(models.TextChoices):
        LOW      = 'low',      'Low'
        MEDIUM   = 'medium',   'Medium'
        HIGH     = 'high',     'High'
        CRITICAL = 'critical', 'Critical'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title        = models.CharField(max_length=255)
    description  = models.TextField(blank=True)
    due_date     = models.DateField()
    priority     = models.CharField(max_length=10, choices=Priority.choices, default=Priority.MEDIUM)
    status       = models.CharField(max_length=15, choices=Status.choices, default=Status.PENDING)
    assigned_to  = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='assigned_actions'
    )
    created_by   = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='created_actions'
    )
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['due_date', '-priority']

    def __str__(self):
        return self.title


class ActionComment(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    action     = models.ForeignKey(ScheduledAction, on_delete=models.CASCADE, related_name='comments')
    author     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    comment    = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f'{self.action.title} — {self.author}'
