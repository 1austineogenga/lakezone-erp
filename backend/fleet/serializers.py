from rest_framework import serializers
from django.utils import timezone
from .models import (
    FleetAPIConfig, Vehicle, VehicleLiveData, FuelEvent,
    TripRecord, FleetAlert, MaintenanceRecord,
    VehicleCompliance, VehicleAssignment, FuelPrice, Geofence, GeofenceEvent,
    VehicleReceivingForm,
)


class FleetAPIConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = FleetAPIConfig
        fields = '__all__'
        extra_kwargs = {'password': {'write_only': True}}


class VehicleLiveDataSerializer(serializers.ModelSerializer):
    odometer_km = serializers.SerializerMethodField()

    class Meta:
        model = VehicleLiveData
        fields = '__all__'

    def get_odometer_km(self, obj):
        return round(obj.odometer / 1000, 2) if obj.odometer else 0


class VehicleComplianceSerializer(serializers.ModelSerializer):
    class Meta:
        model = VehicleCompliance
        fields = '__all__'


class VehicleAssignmentSerializer(serializers.ModelSerializer):
    employee_name = serializers.SerializerMethodField()

    class Meta:
        model = VehicleAssignment
        fields = '__all__'

    def get_employee_name(self, obj):
        if obj.employee:
            return f"{obj.employee.first_name} {obj.employee.last_name}"
        return obj.driver_name


class VehicleSerializer(serializers.ModelSerializer):
    odometer_km = serializers.SerializerMethodField()
    last_seen_minutes_ago = serializers.SerializerMethodField()
    is_online = serializers.SerializerMethodField()
    latest_live_data = serializers.SerializerMethodField()
    compliance = serializers.SerializerMethodField()
    current_assignment = serializers.SerializerMethodField()
    project_name = serializers.CharField(source='project.project_name', read_only=True, allow_null=True, default=None)

    class Meta:
        model = Vehicle
        fields = '__all__'

    def get_odometer_km(self, obj):
        return round(obj.last_odometer / 1000, 2) if obj.last_odometer else 0

    def get_last_seen_minutes_ago(self, obj):
        if obj.last_seen:
            diff = timezone.now() - obj.last_seen
            return int(diff.total_seconds() / 60)
        return None

    def get_is_online(self, obj):
        if not obj.last_seen:
            return False
        from datetime import timedelta
        return (timezone.now() - obj.last_seen).total_seconds() < 600  # 10 min

    def get_latest_live_data(self, obj):
        latest = obj.live_data.order_by('-fetched_at').first()
        if latest:
            return VehicleLiveDataSerializer(latest).data
        return None

    def get_compliance(self, obj):
        items = obj.compliance.all()
        return VehicleComplianceSerializer(items, many=True).data

    def get_current_assignment(self, obj):
        assignment = obj.assignments.filter(is_current=True).first()
        if assignment:
            return VehicleAssignmentSerializer(assignment).data
        return None

    def validate(self, attrs):
        return attrs


class FuelEventSerializer(serializers.ModelSerializer):
    vehicle_no = serializers.CharField(source='vehicle.vehicle_no', read_only=True)
    vehicle_name = serializers.CharField(source='vehicle.vehicle_name', read_only=True)

    class Meta:
        model = FuelEvent
        fields = '__all__'
        read_only_fields = ['price_per_litre', 'total_cost']


class TripRecordSerializer(serializers.ModelSerializer):
    vehicle_no = serializers.CharField(source='vehicle.vehicle_no', read_only=True)

    class Meta:
        model = TripRecord
        fields = '__all__'


class FleetAlertSerializer(serializers.ModelSerializer):
    vehicle_no = serializers.CharField(source='vehicle.vehicle_no', read_only=True)
    acknowledged_by_username = serializers.CharField(source='acknowledged_by.username', read_only=True)

    class Meta:
        model = FleetAlert
        fields = '__all__'


class MaintenanceRecordSerializer(serializers.ModelSerializer):
    vehicle_no = serializers.CharField(source='vehicle.vehicle_no', read_only=True)
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = MaintenanceRecord
        fields = '__all__'
        read_only_fields = ['created_by']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class FuelPriceSerializer(serializers.ModelSerializer):
    class Meta:
        model = FuelPrice
        fields = '__all__'


class GeofenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Geofence
        fields = '__all__'


class GeofenceEventSerializer(serializers.ModelSerializer):
    vehicle_no = serializers.CharField(source='vehicle.vehicle_no', read_only=True)
    geofence_name = serializers.CharField(source='geofence.name', read_only=True)

    class Meta:
        model = GeofenceEvent
        fields = '__all__'


class VehicleReceivingFormSerializer(serializers.ModelSerializer):
    submitted_by_name = serializers.SerializerMethodField()

    class Meta:
        model = VehicleReceivingForm
        fields = '__all__'
        read_only_fields = ['id', 'submitted_by', 'created_at']

    def get_submitted_by_name(self, obj):
        if obj.submitted_by:
            return obj.submitted_by.get_full_name() or obj.submitted_by.email
        return None

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['submitted_by'] = request.user
        return super().create(validated_data)
