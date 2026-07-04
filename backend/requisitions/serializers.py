from rest_framework import serializers
from .models import StaffRequisition, RequisitionItem, RequisitionApproval, MaintenanceSchedule, FuelPaymentRecord


class RequisitionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model  = RequisitionItem
        fields = ['id', 'description', 'quantity', 'unit', 'unit_price', 'total_price', 'stock_item', 'notes']

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError('Quantity must be greater than 0.')
        return value

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError('Unit price must be >= 0.')
        return value


class RequisitionApprovalSerializer(serializers.ModelSerializer):
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)

    class Meta:
        model  = RequisitionApproval
        fields = ['id', 'stage', 'action', 'approved_by', 'approved_by_name', 'comments', 'actioned_at']


class MaintenanceScheduleSerializer(serializers.ModelSerializer):
    logged_by_name   = serializers.CharField(source='logged_by.get_full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)
    requisition_ref  = serializers.CharField(source='requisition.reference_number', read_only=True)
    requisition_title = serializers.CharField(source='requisition.title', read_only=True)

    class Meta:
        model  = MaintenanceSchedule
        fields = [
            'id', 'requisition', 'requisition_ref', 'requisition_title',
            'assigned_to', 'work_description', 'notes', 'scheduled_date',
            'payment_amount', 'payment_details', 'status',
            'logged_by', 'logged_by_name', 'admin_comments',
            'approved_by', 'approved_by_name', 'approved_at',
            'expense_claim', 'created_at', 'updated_at',
        ]
        read_only_fields = ['logged_by', 'approved_by', 'approved_at', 'expense_claim', 'status']


class MaintenanceScheduleCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = MaintenanceSchedule
        fields = [
            'requisition', 'assigned_to', 'work_description', 'notes',
            'scheduled_date', 'payment_amount', 'payment_details',
        ]

    def validate_requisition(self, req):
        if req.req_type != StaffRequisition.ReqType.REPAIR_MAINTENANCE:
            raise serializers.ValidationError('Maintenance schedules can only be created for Repair & Maintenance requisitions.')
        if hasattr(req, 'maintenance_schedule'):
            raise serializers.ValidationError('A maintenance schedule already exists for this requisition.')
        return req

    def create(self, validated_data):
        return MaintenanceSchedule.objects.create(
            **validated_data,
            logged_by=self.context['request'].user,
            status=MaintenanceSchedule.Status.PENDING_APPROVAL,
        )


class FuelPaymentRecordSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    requisition_ref = serializers.CharField(source='requisition.reference_number', read_only=True)

    class Meta:
        model  = FuelPaymentRecord
        fields = [
            'id', 'requisition', 'requisition_ref', 'payment_mode',
            'amount_paid', 'payment_ref', 'notes', 'expense_claim',
            'created_by', 'created_by_name', 'created_at',
        ]
        read_only_fields = ['created_by', 'expense_claim']


class StaffRequisitionSerializer(serializers.ModelSerializer):
    items                = RequisitionItemSerializer(many=True, read_only=True)
    approvals            = RequisitionApprovalSerializer(many=True, read_only=True)
    requested_by_name    = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    requested_by_role    = serializers.CharField(source='requested_by.role', read_only=True)
    department_name      = serializers.CharField(source='department.name', read_only=True)
    project_name         = serializers.CharField(source='project.name', read_only=True)
    has_maintenance_schedule = serializers.SerializerMethodField()
    maintenance_schedule = MaintenanceScheduleSerializer(read_only=True)
    fuel_payment         = FuelPaymentRecordSerializer(read_only=True)
    paid_by_name         = serializers.CharField(source='paid_by.get_full_name', read_only=True)
    expense_claim_ref    = serializers.SerializerMethodField()

    class Meta:
        model  = StaffRequisition
        fields = [
            'id', 'reference_number', 'title', 'req_type', 'status', 'priority',
            'requested_by', 'requested_by_name', 'requested_by_role',
            'department', 'department_name', 'project', 'project_name',
            'description', 'date_required', 'total_amount', 'rejection_reason',
            'payment_method', 'payment_business_number', 'payment_account_number',
            'payment_till_number', 'payment_bank_name', 'payment_account_name', 'payment_branch_name',
            'fleet_vehicle_no',
            'created_at', 'updated_at',
            'fulfilled_by', 'fulfilled_at', 'fulfillment_notes',
            'paid_by', 'paid_by_name', 'paid_at', 'paid_mode', 'payment_confirmed_notes',
            'expense_claim_ref',
            'items', 'approvals',
            'has_maintenance_schedule', 'maintenance_schedule', 'fuel_payment',
        ]
        read_only_fields = ['reference_number', 'requested_by', 'total_amount', 'status', 'rejection_reason']

    def get_has_maintenance_schedule(self, obj):
        return hasattr(obj, 'maintenance_schedule')

    def get_expense_claim_ref(self, obj):
        try:
            from finance.models import ExpenseClaim
            claim = ExpenseClaim.objects.filter(requisition=obj).first()
            return claim.reference if claim else None
        except Exception:
            return None


class StaffRequisitionListSerializer(serializers.ModelSerializer):
    """Lighter serializer for list views."""
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    project_name      = serializers.CharField(source='project.name', read_only=True)
    has_maintenance_schedule = serializers.SerializerMethodField()

    class Meta:
        model  = StaffRequisition
        fields = [
            'id', 'reference_number', 'title', 'req_type', 'status', 'priority',
            'requested_by_name', 'project_name', 'total_amount', 'date_required',
            'created_at', 'has_maintenance_schedule',
        ]

    def get_has_maintenance_schedule(self, obj):
        return hasattr(obj, 'maintenance_schedule')


class StaffRequisitionCreateSerializer(serializers.ModelSerializer):
    items = RequisitionItemSerializer(many=True)

    class Meta:
        model  = StaffRequisition
        fields = ['title', 'req_type', 'priority', 'department', 'project',
                  'description', 'date_required',
                  'payment_method', 'payment_business_number', 'payment_account_number',
                  'payment_till_number', 'payment_bank_name', 'payment_account_name', 'payment_branch_name',
                  'fleet_vehicle_no',
                  'items']

    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError('At least one item is required.')
        return value

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        req = StaffRequisition.objects.create(
            **validated_data,
            requested_by=self.context['request'].user,
            status=StaffRequisition.Status.SUBMITTED,
        )
        for item in items_data:
            RequisitionItem.objects.create(requisition=req, **item)
        req.recalculate_total()
        return req


class ApprovalActionSerializer(serializers.Serializer):
    action   = serializers.ChoiceField(choices=RequisitionApproval.Action.choices)
    comments = serializers.CharField(required=False, allow_blank=True)


class ScheduleApproveSerializer(serializers.Serializer):
    comments = serializers.CharField(required=False, allow_blank=True)
    action   = serializers.ChoiceField(choices=['approved', 'cancelled'])
