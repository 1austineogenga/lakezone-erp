from rest_framework import serializers
from .models import (
    Project, BOQ, BOQBill, BOQItem, Budget, BudgetRate, BudgetLineItem,
    IPC, IPCItem, ProjectRisk, ProjectVehicle, ProjectPersonnel, WeeklyProgress
)


class BOQItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = BOQItem
        fields = '__all__'


class BOQBillSerializer(serializers.ModelSerializer):
    items = BOQItemSerializer(many=True, read_only=True)

    class Meta:
        model = BOQBill
        fields = '__all__'


class BOQSerializer(serializers.ModelSerializer):
    bills = BOQBillSerializer(many=True, read_only=True)
    grand_total = serializers.SerializerMethodField()

    class Meta:
        model = BOQ
        fields = '__all__'

    def get_grand_total(self, obj):
        sub_total = sum(bill.sub_total for bill in obj.bills.all())
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


class BudgetSerializer(serializers.ModelSerializer):
    rates = BudgetRateSerializer(many=True, read_only=True)

    class Meta:
        model = Budget
        fields = '__all__'


class IPCItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = IPCItem
        fields = '__all__'


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
    class Meta:
        model = ProjectVehicle
        fields = '__all__'


class ProjectPersonnelSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectPersonnel
        fields = '__all__'


class WeeklyProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = WeeklyProgress
        fields = '__all__'


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = [
            'id', 'code', 'name', 'client', 'contract_number', 'contract_value',
            'location', 'start_date', 'end_date', 'status', 'description', 'created_at',
        ]


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
