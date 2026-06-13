from django.contrib import admin
from .models import (
    Project, BOQ, BOQBill, BOQItem, Budget, BudgetRate, BudgetLineItem,
    IPC, IPCItem, ProjectRisk, ProjectVehicle, ProjectPersonnel, WeeklyProgress
)


class BOQBillInline(admin.TabularInline):
    model = BOQBill
    extra = 0
    fields = ['bill_number', 'description', 'sub_total', 'order']
    readonly_fields = ['sub_total']


class BOQItemInline(admin.TabularInline):
    model = BOQItem
    extra = 0
    fields = ['item_number', 'description', 'unit', 'quantity', 'rate', 'amount']


class BudgetRateInline(admin.TabularInline):
    model = BudgetRate
    extra = 0
    fields = ['name', 'value', 'unit', 'used_in']


class IPCItemInline(admin.TabularInline):
    model = IPCItem
    extra = 0
    fields = ['description', 'unit', 'quantity_this_ipc', 'quantity_to_date', 'rate', 'amount']


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['code', 'name', 'client', 'status', 'contract_value', 'start_date', 'end_date']
    list_filter = ['status']
    search_fields = ['code', 'name', 'client', 'contract_number']
    readonly_fields = ['created_at', 'updated_at']
    ordering = ['-created_at']


@admin.register(BOQ)
class BOQAdmin(admin.ModelAdmin):
    list_display = ['project', 'title', 'contingency_pct', 'vop_pct', 'uploaded_at']
    list_filter = ['project']
    search_fields = ['title', 'project__code', 'project__name']
    inlines = [BOQBillInline]


@admin.register(BOQBill)
class BOQBillAdmin(admin.ModelAdmin):
    list_display = ['bill_number', 'boq', 'description', 'sub_total', 'order']
    list_filter = ['boq__project']
    search_fields = ['bill_number', 'description']
    inlines = [BOQItemInline]


@admin.register(BOQItem)
class BOQItemAdmin(admin.ModelAdmin):
    list_display = ['item_number', 'bill', 'description', 'unit', 'quantity', 'rate', 'amount']
    list_filter = ['bill__boq__project']
    search_fields = ['item_number', 'description']


@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ['project', 'title', 'period_weeks', 'status', 'created_at']
    list_filter = ['status', 'project']
    search_fields = ['title', 'project__code', 'project__name']
    inlines = [BudgetRateInline]
    readonly_fields = ['created_at']


@admin.register(BudgetRate)
class BudgetRateAdmin(admin.ModelAdmin):
    list_display = ['name', 'budget', 'value', 'unit', 'used_in']
    list_filter = ['budget__project']
    search_fields = ['name', 'used_in']


@admin.register(BudgetLineItem)
class BudgetLineItemAdmin(admin.ModelAdmin):
    list_display = ['budget', 'week_no', 'month_no', 'category', 'description', 'base_cost', 'high_case_cost']
    list_filter = ['category', 'budget__project']
    search_fields = ['description', 'work_focus']
    ordering = ['budget', 'week_no', 'month_no', 'category']


@admin.register(IPC)
class IPCAdmin(admin.ModelAdmin):
    list_display = ['project', 'ipc_number', 'period_from', 'period_to', 'amount_claimed', 'amount_certified', 'amount_paid', 'status']
    list_filter = ['status', 'project']
    search_fields = ['project__code', 'project__name']
    readonly_fields = ['created_at']
    inlines = [IPCItemInline]


@admin.register(IPCItem)
class IPCItemAdmin(admin.ModelAdmin):
    list_display = ['ipc', 'description', 'unit', 'quantity_this_ipc', 'rate', 'amount']
    list_filter = ['ipc__project']
    search_fields = ['description']


@admin.register(ProjectRisk)
class ProjectRiskAdmin(admin.ModelAdmin):
    list_display = ['project', 'risk_description', 'impact_level', 'status', 'owner', 'created_at']
    list_filter = ['impact_level', 'status', 'project']
    search_fields = ['risk_description', 'owner', 'project__code']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(ProjectVehicle)
class ProjectVehicleAdmin(admin.ModelAdmin):
    list_display = ['project', 'vehicle', 'assigned_from', 'assigned_to', 'daily_rate', 'is_active']
    list_filter = ['is_active', 'project']
    search_fields = ['vehicle__vehicle_no', 'project__code']


@admin.register(ProjectPersonnel)
class ProjectPersonnelAdmin(admin.ModelAdmin):
    list_display = ['project', 'employee_name', 'role', 'start_date', 'end_date', 'monthly_rate', 'include_in_budget']
    list_filter = ['role', 'include_in_budget', 'project']
    search_fields = ['employee_name', 'project__code']


@admin.register(WeeklyProgress)
class WeeklyProgressAdmin(admin.ModelAdmin):
    list_display = ['project', 'week_no', 'week_start', 'week_end', 'total_actual', 'casual_headcount', 'submitted_by']
    list_filter = ['project']
    search_fields = ['project__code', 'submitted_by', 'work_focus']
    readonly_fields = ['submitted_at']
