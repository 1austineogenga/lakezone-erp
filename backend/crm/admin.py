from django.contrib import admin
from .models import Client, TenderOpportunity


@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ["company_name", "contact_person", "email", "phone", "is_active"]
    search_fields = ["company_name", "contact_person"]


@admin.register(TenderOpportunity)
class TenderOpportunityAdmin(admin.ModelAdmin):
    list_display = ["opportunity_name", "client", "stage", "estimated_value", "submission_deadline"]
    list_filter = ["stage"]
    search_fields = ["opportunity_name", "tender_number"]
