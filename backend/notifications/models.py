from django.db import models
from django.conf import settings


class Notification(models.Model):
    class Type(models.TextChoices):
        PR_APPROVED   = "pr_approved",   "PR Approved"
        PR_REJECTED   = "pr_rejected",   "PR Rejected"
        PR_SUBMITTED  = "pr_submitted",  "PR Submitted for Approval"
        PO_APPROVED   = "po_approved",   "PO Approved"
        LOW_STOCK     = "low_stock",     "Low Stock Alert"
        TENDER_DUE    = "tender_due",    "Tender Deadline Soon"
        IPC_ISSUED    = "ipc_issued",    "IPC Issued"
        GENERAL       = "general",       "General"

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
