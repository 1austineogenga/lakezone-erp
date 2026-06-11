from django.contrib import admin
from .models import Supplier, PurchaseRequisition, PRLineItem, PurchaseOrder, POLineItem


class PRLineItemInline(admin.TabularInline):
    model = PRLineItem
    extra = 0


class POLineItemInline(admin.TabularInline):
    model = POLineItem
    extra = 0
    readonly_fields = ["line_total"]


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ["company_name", "kra_pin", "contact_person", "email", "status", "performance_rating"]
    list_filter = ["status"]
    search_fields = ["company_name", "kra_pin"]


@admin.register(PurchaseRequisition)
class PRAdmin(admin.ModelAdmin):
    list_display = ["pr_number", "requested_by", "department", "project", "status", "required_by_date"]
    list_filter = ["status"]
    search_fields = ["pr_number"]
    inlines = [PRLineItemInline]
    readonly_fields = ["pr_number", "created_at", "updated_at"]


@admin.register(PurchaseOrder)
class POAdmin(admin.ModelAdmin):
    list_display = ["po_number", "supplier", "project", "status", "delivery_date", "created_at"]
    list_filter = ["status"]
    search_fields = ["po_number", "supplier__company_name"]
    inlines = [POLineItemInline]
    readonly_fields = ["po_number", "created_at", "updated_at"]
