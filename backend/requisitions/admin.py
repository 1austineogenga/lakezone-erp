from django.contrib import admin
from .models import StaffRequisition, RequisitionItem, RequisitionApproval


class RequisitionItemInline(admin.TabularInline):
    model  = RequisitionItem
    extra  = 0
    fields = ['description', 'quantity', 'unit', 'unit_price', 'total_price', 'stock_item', 'notes']
    readonly_fields = ['total_price']


class RequisitionApprovalInline(admin.TabularInline):
    model  = RequisitionApproval
    extra  = 0
    fields = ['stage', 'action', 'approved_by', 'comments', 'actioned_at']
    readonly_fields = ['actioned_at']


@admin.register(StaffRequisition)
class StaffRequisitionAdmin(admin.ModelAdmin):
    list_display   = ['reference_number', 'title', 'req_type', 'status', 'priority',
                      'requested_by', 'department', 'total_amount', 'created_at']
    list_filter    = ['status', 'req_type', 'priority']
    search_fields  = ['reference_number', 'title']
    readonly_fields = ['reference_number', 'total_amount', 'created_at', 'updated_at']
    inlines        = [RequisitionItemInline, RequisitionApprovalInline]
