import uuid
from django.db import models
from django.conf import settings


class OpportunityStage(models.TextChoices):
    PROSPECT = "prospect", "Prospect"
    QUALIFIED = "qualified", "Qualified"
    BID_PREP = "bid_prep", "Bid Preparation"
    SUBMITTED = "submitted", "Submitted"
    WON = "won", "Won"
    LOST = "lost", "Lost"


class Client(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_name = models.CharField(max_length=255)
    contact_person = models.CharField(max_length=200)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    address = models.TextField(blank=True)
    kra_pin = models.CharField(max_length=20, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["company_name"]

    def __str__(self):
        return self.company_name


class TenderOpportunity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    opportunity_name = models.CharField(max_length=255)
    client = models.ForeignKey(Client, on_delete=models.PROTECT, related_name="opportunities")
    tender_number = models.CharField(max_length=100, blank=True)
    estimated_value = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    stage = models.CharField(
        max_length=20, choices=OpportunityStage.choices, default=OpportunityStage.PROSPECT
    )
    submission_deadline = models.DateTimeField(null=True, blank=True)
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="opportunities"
    )
    probability_percent = models.IntegerField(null=True, blank=True)
    win_loss_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name_plural = "tender opportunities"

    def __str__(self):
        return f"{self.opportunity_name} ({self.get_stage_display()})"
