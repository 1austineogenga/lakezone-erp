from django.contrib import admin
from .models import (
    JobGrade, Position, Employee, EmployeeDocument,
    BiometricDevice, AttendanceRecord,
    LeaveType, LeaveBalance, LeaveApplication,
    PayrollPeriod, PayrollEntry, SalaryAdvance, DisciplinaryRecord,
)


class EmployeeDocumentInline(admin.TabularInline):
    model           = EmployeeDocument
    extra           = 0
    fields          = ['doc_type', 'title', 'file_ref', 'uploaded_at']
    readonly_fields = ['uploaded_at']


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display    = ['employee_number', 'full_name', 'employment_type', 'department', 'is_active']
    list_filter     = ['employment_type', 'is_active', 'department']
    search_fields   = ['first_name', 'last_name', 'employee_number', 'phone']
    inlines         = [EmployeeDocumentInline]
    readonly_fields = ['employee_number']


@admin.register(JobGrade)
class JobGradeAdmin(admin.ModelAdmin):
    list_display = ['name', 'basic_salary_min', 'basic_salary_max']


@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = ['title', 'department', 'job_grade', 'is_active']
    list_filter  = ['department', 'is_active']


@admin.register(BiometricDevice)
class BiometricDeviceAdmin(admin.ModelAdmin):
    list_display    = ['name', 'device_id', 'location', 'device_type', 'is_active', 'last_sync']
    readonly_fields = ['api_key', 'last_sync']


@admin.register(AttendanceRecord)
class AttendanceRecordAdmin(admin.ModelAdmin):
    list_display   = ['employee', 'date', 'status', 'time_in', 'time_out', 'source']
    list_filter    = ['status', 'source', 'date']
    search_fields  = ['employee__first_name', 'employee__last_name', 'employee__employee_number']
    date_hierarchy = 'date'


@admin.register(LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'days_entitled', 'is_paid', 'applicable_to']


@admin.register(LeaveApplication)
class LeaveApplicationAdmin(admin.ModelAdmin):
    list_display  = ['reference', 'employee', 'leave_type', 'start_date', 'end_date', 'status']
    list_filter   = ['status', 'leave_type']
    search_fields = ['reference', 'employee__first_name', 'employee__last_name']


class PayrollEntryInline(admin.TabularInline):
    model           = PayrollEntry
    extra           = 0
    fields          = ['employee', 'gross_pay', 'paye', 'nssf_employee', 'nhif_employee', 'net_pay']
    readonly_fields = ['gross_pay', 'paye', 'nssf_employee', 'nhif_employee', 'net_pay']


@admin.register(PayrollPeriod)
class PayrollPeriodAdmin(admin.ModelAdmin):
    list_display = ['name', 'status', 'payment_date']
    list_filter  = ['status']
    inlines      = [PayrollEntryInline]


@admin.register(SalaryAdvance)
class SalaryAdvanceAdmin(admin.ModelAdmin):
    list_display = ['employee', 'amount', 'status', 'created_at']
    list_filter  = ['status']


@admin.register(DisciplinaryRecord)
class DisciplinaryAdmin(admin.ModelAdmin):
    list_display  = ['employee', 'record_type', 'incident_date', 'action_taken']
    list_filter   = ['record_type']
    search_fields = ['employee__first_name', 'employee__last_name']
