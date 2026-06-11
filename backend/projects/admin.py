from django.contrib import admin
from .models import Project, Tender, BOQItem, ProjectDocument


class TenderInline(admin.TabularInline):
    model = Tender
    extra = 0
    fields = ["tender_number", "tender_value", "tender_status", "submission_date", "award_date"]


class BOQItemInline(admin.TabularInline):
    model = BOQItem
    extra = 0
    fields = ["item_code", "description", "unit", "quantity", "unit_rate", "total_cost", "progress_percent"]
    readonly_fields = ["total_cost"]


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ["contract_number", "project_name", "project_manager", "status", "contract_sum", "start_date"]
    list_filter = ["status"]
    search_fields = ["project_name", "contract_number"]
    inlines = [TenderInline]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(Tender)
class TenderAdmin(admin.ModelAdmin):
    list_display = ["tender_number", "project", "tender_value", "tender_status", "award_date"]
    list_filter = ["tender_status"]
    search_fields = ["tender_number"]
    inlines = [BOQItemInline]


@admin.register(BOQItem)
class BOQItemAdmin(admin.ModelAdmin):
    list_display = ["item_code", "description", "unit", "quantity", "unit_rate", "total_cost", "actual_cost"]
    search_fields = ["item_code", "description"]
    readonly_fields = ["total_cost"]
