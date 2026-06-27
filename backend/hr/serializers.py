from rest_framework import serializers
from .models import (
    JobGrade, Position, Employee, EmployeeDocument,
    BiometricDevice, AttendanceRecord,
    LeaveType, LeaveBalance, LeaveApplication,
    PayrollPeriod, PayrollEntry, SalaryAdvance, DisciplinaryRecord,
    EmployeeTransfer,
)


class JobGradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobGrade
        fields = '__all__'


class PositionSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    job_grade_name  = serializers.CharField(source='job_grade.name', read_only=True)

    class Meta:
        model  = Position
        fields = '__all__'


class EmployeeSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.name', read_only=True)
    position_title  = serializers.CharField(source='position.title', read_only=True)
    branch_name     = serializers.CharField(source='branch.name', read_only=True)
    full_name       = serializers.SerializerMethodField()

    class Meta:
        model  = Employee
        fields = '__all__'
        # New fields added: account_name, next_of_kin_*, emergency_contact2_*,
        # blood_group, allergies, chronic_conditions, disability, disability_details,
        # medical_insurance, medical_insurance_category, medical_insurance_deduction

    def get_full_name(self, obj):
        return obj.full_name


class EmployeeListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for dropdowns."""
    full_name       = serializers.SerializerMethodField()
    department_name = serializers.CharField(source='department.name', read_only=True)
    position_title  = serializers.CharField(source='position.title', read_only=True)
    branch_name     = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model  = Employee
        fields = [
            'id', 'employee_number', 'full_name', 'employment_type',
            'department_name', 'position_title', 'branch_name', 'is_active',
        ]

    def get_full_name(self, obj):
        return obj.full_name


class EmployeeDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EmployeeDocument
        fields = '__all__'


class BiometricDeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model  = BiometricDevice
        fields = '__all__'
        read_only_fields = ['api_key', 'last_sync', 'records_count']


class AttendanceRecordSerializer(serializers.ModelSerializer):
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    full_name       = serializers.SerializerMethodField()
    employment_type = serializers.CharField(source='employee.employment_type', read_only=True)
    device_name     = serializers.CharField(source='biometric_device.name', read_only=True)

    class Meta:
        model  = AttendanceRecord
        fields = '__all__'

    def get_full_name(self, obj):
        return obj.employee.full_name


class DailySheetSerializer(serializers.Serializer):
    """Read-only daily attendance snapshot."""
    employee_id     = serializers.UUIDField()
    employee_number = serializers.CharField()
    full_name       = serializers.CharField()
    employment_type = serializers.CharField()
    status          = serializers.CharField()
    time_in         = serializers.TimeField(allow_null=True)
    time_out        = serializers.TimeField(allow_null=True)
    late_minutes    = serializers.IntegerField()
    source          = serializers.CharField(allow_null=True)


class BulkAttendanceSerializer(serializers.Serializer):
    class RecordItem(serializers.Serializer):
        employee = serializers.UUIDField()
        date     = serializers.DateField()
        status   = serializers.ChoiceField(choices=AttendanceRecord.Status.choices)
        time_in  = serializers.TimeField(required=False, allow_null=True)
        time_out = serializers.TimeField(required=False, allow_null=True)

    records = RecordItem(many=True)


class BiometricPushSerializer(serializers.Serializer):
    device_id       = serializers.CharField()
    employee_number = serializers.CharField()
    timestamp       = serializers.DateTimeField()
    event_type      = serializers.ChoiceField(choices=['in', 'out'])


class LeaveTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model  = LeaveType
        fields = '__all__'


class LeaveBalanceSerializer(serializers.ModelSerializer):
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    balance         = serializers.IntegerField(read_only=True)

    class Meta:
        model  = LeaveBalance
        fields = '__all__'


class LeaveApplicationSerializer(serializers.ModelSerializer):
    employee_name   = serializers.SerializerMethodField()
    leave_type_name = serializers.CharField(source='leave_type.name', read_only=True)
    days            = serializers.IntegerField(read_only=True)

    class Meta:
        model  = LeaveApplication
        fields = '__all__'
        read_only_fields = ['reference', 'reviewed_by', 'reviewed_at']

    def get_employee_name(self, obj):
        return obj.employee.full_name


class LeaveReviewSerializer(serializers.Serializer):
    action       = serializers.ChoiceField(choices=['approved', 'rejected', 'cancelled'])
    review_notes = serializers.CharField(required=False, allow_blank=True)


class PayrollPeriodSerializer(serializers.ModelSerializer):
    entry_count = serializers.SerializerMethodField()

    class Meta:
        model  = PayrollPeriod
        fields = '__all__'

    def get_entry_count(self, obj):
        return obj.entries.count()


class PayrollEntrySerializer(serializers.ModelSerializer):
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    full_name       = serializers.SerializerMethodField()
    employment_type = serializers.CharField(source='employee.employment_type', read_only=True)
    department_name = serializers.CharField(source='employee.department.name', read_only=True)
    project_name    = serializers.CharField(source='project.project_name', read_only=True)

    class Meta:
        model  = PayrollEntry
        fields = '__all__'
        read_only_fields = [
            'paye', 'nssf_employee', 'nhif_employee', 'nssf_employer', 'nhif_employer',
            'gross_pay', 'total_deductions', 'net_pay',
        ]

    def get_full_name(self, obj):
        return obj.employee.full_name


class SalaryAdvanceSerializer(serializers.ModelSerializer):
    employee_name   = serializers.SerializerMethodField()
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)

    class Meta:
        model  = SalaryAdvance
        fields = '__all__'
        read_only_fields = ['reference', 'approved_by', 'approved_at', 'request_date']

    def get_employee_name(self, obj):
        return obj.employee.full_name


class AdvanceReviewSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=['approved', 'rejected'])
    notes  = serializers.CharField(required=False, allow_blank=True)


class DisciplinaryRecordSerializer(serializers.ModelSerializer):
    employee_name   = serializers.SerializerMethodField()
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)

    class Meta:
        model  = DisciplinaryRecord
        fields = '__all__'

    def get_employee_name(self, obj):
        return obj.employee.full_name


class EmployeeTransferSerializer(serializers.ModelSerializer):
    employee_name    = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number  = serializers.CharField(source='employee.employee_number', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    reviewed_by_name  = serializers.CharField(source='reviewed_by.get_full_name', read_only=True)
    total_allowance   = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)
    project_name      = serializers.CharField(source='project.project_name', read_only=True)

    class Meta:
        model  = EmployeeTransfer
        fields = [
            'id', 'employee', 'employee_name', 'employee_number',
            'transfer_type', 'destination_type',
            'from_location', 'to_location',
            'project', 'project_name',
            'start_date', 'end_date', 'reason',
            'relocation_allowance', 'daily_allowance', 'daily_allowance_days', 'total_allowance',
            'status',
            'requested_by', 'requested_by_name',
            'reviewed_by', 'reviewed_by_name', 'reviewed_at', 'review_notes',
            'created_at',
        ]
        read_only_fields = ['requested_by', 'reviewed_by', 'reviewed_at', 'total_allowance']


class EmployeeTransferCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EmployeeTransfer
        fields = [
            'employee', 'transfer_type', 'destination_type',
            'from_location', 'to_location', 'project',
            'start_date', 'end_date', 'reason',
            'relocation_allowance', 'daily_allowance', 'daily_allowance_days',
        ]

    def create(self, validated_data):
        return EmployeeTransfer.objects.create(
            **validated_data,
            requested_by=self.context['request'].user,
            status=EmployeeTransfer.Status.DRAFT,
        )


class TransferReviewSerializer(serializers.Serializer):
    action       = serializers.ChoiceField(choices=['approved', 'rejected'])
    review_notes = serializers.CharField(required=False, allow_blank=True)
