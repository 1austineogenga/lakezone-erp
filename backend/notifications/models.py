import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


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


# ── Compliance Renewal Workflow ────────────────────────────────────────────────

class ComplianceRenewalCase(models.Model):
    STEP_OPEN       = 'open'
    STEP_ACK        = 'acknowledged'
    STEP_CONTACTED  = 'contacted'
    STEP_INVOICE    = 'invoice_received'
    STEP_PAYMENT    = 'payment_processed'
    STEP_CERT       = 'certificate_updated'
    STEP_CLOSED     = 'closed'

    STEPS = [
        STEP_OPEN, STEP_ACK, STEP_CONTACTED,
        STEP_INVOICE, STEP_PAYMENT, STEP_CERT, STEP_CLOSED,
    ]

    STEP_LABELS = {
        STEP_OPEN:      'Case Opened',
        STEP_ACK:       'Acknowledged',
        STEP_CONTACTED: 'Provider Contacted',
        STEP_INVOICE:   'Invoice Received',
        STEP_PAYMENT:   'Payment Processed',
        STEP_CERT:      'Certificate Updated',
        STEP_CLOSED:    'Closed',
    }

    # Labels per compliance type for the "contacted" step
    CONTACT_STEP_LABEL = {
        'insurance':      'Contacted Insurer',
        'inspection':     'Booked Inspection',
        'speed_governor': 'Booked Calibration',
    }

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Asset reference (cached so it survives vehicle/asset changes)
    vehicle_compliance = models.ForeignKey(
        'fleet.VehicleCompliance', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='renewal_cases'
    )
    asset_name      = models.CharField(max_length=200)
    asset_ref       = models.CharField(max_length=100, blank=True)
    compliance_type = models.CharField(max_length=30)   # insurance|inspection|speed_governor
    original_expiry = models.DateField(null=True, blank=True)

    # Workflow state
    status      = models.CharField(max_length=30, default=STEP_OPEN)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='compliance_cases_assigned'
    )

    # Step 3 — provider contact
    provider_name    = models.CharField(max_length=200, blank=True)
    provider_contact = models.CharField(max_length=200, blank=True)
    contacted_date   = models.DateField(null=True, blank=True)

    # Step 4 — invoice details
    invoice_ref       = models.CharField(max_length=100, blank=True)
    invoice_amount    = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    invoice_due_date  = models.DateField(null=True, blank=True)
    bill              = models.ForeignKey(
        'finance.Bill', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='compliance_cases'
    )

    # Step 6 — renewal data
    new_expiry      = models.DateField(null=True, blank=True)
    new_cert_number = models.CharField(max_length=100, blank=True)

    # Metadata
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT,
        related_name='created_compliance_cases'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at  = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.asset_name} — {self.compliance_type} ({self.status})"

    @property
    def step_index(self):
        try:
            return self.STEPS.index(self.status)
        except ValueError:
            return 0

    def next_step(self):
        idx = self.step_index
        if idx < len(self.STEPS) - 1:
            return self.STEPS[idx + 1]
        return None


class ComplianceCaseStep(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case       = models.ForeignKey(ComplianceRenewalCase, on_delete=models.CASCADE, related_name='steps')
    step       = models.CharField(max_length=30)
    note       = models.TextField(blank=True)
    actioned_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    actioned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['actioned_at']

    def __str__(self):
        return f"{self.case} — {self.step}"
