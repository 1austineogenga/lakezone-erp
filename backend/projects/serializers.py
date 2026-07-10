from rest_framework import serializers
from .models import (
    Project, BOQ, BOQBill, BOQItem, Budget, BudgetRate, BudgetLineItem,
    IPC, IPCItem, ProjectRisk, ProjectVehicle, ProjectPersonnel, WeeklyProgress,
    ProjectPhase, ProjectActivity, ActivityProgress, VariationOrder,
)


class BOQItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BOQItem
        fields = '__all__'

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0.")
        return value

    def validate_rate(self, value):
        if value < 0:
            raise serializers.ValidationError("Rate must be 0 or greater.")
        return value


class BOQBillSerializer(serializers.ModelSerializer):
    items = BOQItemSerializer(many=True, read_only=True)

    class Meta:
        model = BOQBill
        fields = '__all__'


class BOQSerializer(serializers.ModelSerializer):
    bills = BOQBillSerializer(many=True, read_only=True)
    sub_total = serializers.SerializerMethodField()
    grand_total = serializers.SerializerMethodField()

    class Meta:
        model = BOQ
        fields = [
            'id', 'project', 'title', 'contingency_pct', 'vop_pct',
            'notes', 'uploaded_at', 'bills', 'sub_total', 'grand_total',
        ]

    def _bill_subtotal(self, obj):
        return sum(bill.sub_total for bill in obj.bills.all())

    def get_sub_total(self, obj):
        return round(float(self._bill_subtotal(obj)), 2)

    def get_grand_total(self, obj):
        sub_total = self._bill_subtotal(obj)
        multiplier = (1 + obj.contingency_pct / 100) * (1 + obj.vop_pct / 100)
        return round(float(sub_total) * float(multiplier), 2)


class BudgetRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = BudgetRate
        fields = '__all__'


class BudgetLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BudgetLineItem
        fields = '__all__'

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0.")
        return value

    def validate_base_rate(self, value):
        if value < 0:
            raise serializers.ValidationError("Base rate must be 0 or greater.")
        return value

    def validate(self, attrs):
        # Prevent edits when budget is APPROVED
        budget = attrs.get('budget') or (self.instance.budget if self.instance else None)
        if budget and budget.status == 'approved':
            raise serializers.ValidationError(
                "Budget line items cannot be edited once the budget is approved."
            )
        return attrs


class BudgetSerializer(serializers.ModelSerializer):
    rates = BudgetRateSerializer(many=True, read_only=True)

    class Meta:
        model = Budget
        fields = '__all__'


class IPCItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = IPCItem
        fields = '__all__'

    def validate_quantity_this_ipc(self, value):
        if value < 0:
            raise serializers.ValidationError("Quantity must be 0 or greater.")
        return value

    def validate_quantity_to_date(self, value):
        if value < 0:
            raise serializers.ValidationError("Quantity to date must be 0 or greater.")
        return value

    def validate_rate(self, value):
        if value < 0:
            raise serializers.ValidationError("Rate must be 0 or greater.")
        return value


class IPCSerializer(serializers.ModelSerializer):
    items = IPCItemSerializer(many=True, read_only=True)

    class Meta:
        model = IPC
        fields = '__all__'


class ProjectRiskSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectRisk
        fields = '__all__'


class ProjectVehicleSerializer(serializers.ModelSerializer):
    vehicle_no   = serializers.CharField(source='vehicle.vehicle_no',   read_only=True)
    vehicle_name = serializers.CharField(source='vehicle.vehicle_name', read_only=True)

    class Meta:
        model = ProjectVehicle
        fields = '__all__'
        read_only_fields = ['project']


class ProjectPersonnelSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectPersonnel
        fields = '__all__'


class WeeklyProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyProgress
        fields = '__all__'


class ProjectSerializer(serializers.ModelSerializer):
    open_risks = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'code', 'name', 'client', 'contract_number', 'contract_value',
            'location', 'latitude', 'longitude', 'start_date', 'end_date', 'status', 'description', 'created_at',
            'open_risks',
        ]

    def get_open_risks(self, obj):
        return obj.risks.filter(status__in=['open', 'escalated']).count()

    def validate_contract_value(self, value):
        if value < 0:
            raise serializers.ValidationError("Contract value must be 0 or greater.")
        return value

    def validate_latitude(self, value):
        if value is not None and not (-90 <= value <= 90):
            raise serializers.ValidationError("Latitude must be between -90 and 90.")
        return value

    def validate_longitude(self, value):
        if value is not None and not (-180 <= value <= 180):
            raise serializers.ValidationError("Longitude must be between -180 and 180.")
        return value

    def validate(self, attrs):
        start_date = attrs.get('start_date') or (self.instance.start_date if self.instance else None)
        end_date = attrs.get('end_date') or (self.instance.end_date if self.instance else None)
        if start_date and end_date and start_date >= end_date:
            raise serializers.ValidationError({"end_date": "End date must be after start date."})
        return attrs


class ProjectDetailSerializer(serializers.ModelSerializer):
    boqs_count = serializers.SerializerMethodField()
    budgets_count = serializers.SerializerMethodField()
    ipcs_count = serializers.SerializerMethodField()
    risks_count = serializers.SerializerMethodField()
    assigned_vehicles_count = serializers.SerializerMethodField()
    personnel_count = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'code', 'name', 'client', 'contract_number', 'contract_value',
            'location', 'start_date', 'end_date', 'status', 'description', 'created_at',
            'updated_at', 'boqs_count', 'budgets_count', 'ipcs_count', 'risks_count',
            'assigned_vehicles_count', 'personnel_count',
        ]

    def get_boqs_count(self, obj): return obj.boqs.count()
    def get_budgets_count(self, obj): return obj.budgets.count()
    def get_ipcs_count(self, obj): return obj.ipcs.count()
    def get_risks_count(self, obj): return obj.risks.count()
    def get_assigned_vehicles_count(self, obj): return obj.assigned_vehicles.count()
    def get_personnel_count(self, obj): return obj.personnel.count()

    def validate_contract_value(self, value):
        if value < 0:
            raise serializers.ValidationError("Contract value must be 0 or greater.")
        return value

    def validate_latitude(self, value):
        if value is not None and not (-90 <= value <= 90):
            raise serializers.ValidationError("Latitude must be between -90 and 90.")
        return value

    def validate_longitude(self, value):
        if value is not None and not (-180 <= value <= 180):
            raise serializers.ValidationError("Longitude must be between -180 and 180.")
        return value

    def validate(self, attrs):
        start_date = attrs.get('start_date') or (self.instance.start_date if self.instance else None)
        end_date = attrs.get('end_date') or (self.instance.end_date if self.instance else None)
        if start_date and end_date and start_date >= end_date:
            raise serializers.ValidationError({"end_date": "End date must be after start date."})
        return attrs


class ActivityProgressSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ActivityProgress
        fields = '__all__'
        read_only_fields = ['id', 'recorded_by', 'created_at']

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return obj.recorded_by.get_full_name() or obj.recorded_by.email
        return None

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['recorded_by'] = request.user
        return super().create(validated_data)


class ProjectActivitySerializer(serializers.ModelSerializer):
    latest_progress = serializers.SerializerMethodField()
    duration_days = serializers.SerializerMethodField()

    class Meta:
        model = ProjectActivity
        fields = '__all__'
        read_only_fields = ['id', 'created_at']

    def get_latest_progress(self, obj):
        entry = obj.progress_entries.first()
        if entry:
            return {'date': entry.date, 'percent_complete': entry.percent_complete, 'notes': entry.notes}
        return None

    def get_duration_days(self, obj):
        if obj.planned_start and obj.planned_end:
            return (obj.planned_end - obj.planned_start).days
        return None


class ProjectPhaseSerializer(serializers.ModelSerializer):
    activities = ProjectActivitySerializer(many=True, read_only=True)
    percent_complete = serializers.SerializerMethodField()
    activity_count = serializers.SerializerMethodField()
    completed_count = serializers.SerializerMethodField()

    class Meta:
        model = ProjectPhase
        fields = '__all__'
        read_only_fields = ['id']

    def get_percent_complete(self, obj):
        return obj.percent_complete

    def get_activity_count(self, obj):
        return obj.activities.count()

    def get_completed_count(self, obj):
        return obj.activities.filter(status='completed').count()


class VariationOrderSerializer(serializers.ModelSerializer):
    approved_by_name = serializers.SerializerMethodField()
    created_by_name  = serializers.SerializerMethodField()

    class Meta:
        model  = VariationOrder
        fields = '__all__'
        read_only_fields = ['id', 'vo_number', 'created_by', 'created_at', 'updated_at']

    def get_approved_by_name(self, obj):
        return obj.approved_by.get_full_name() if obj.approved_by else None

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else None
