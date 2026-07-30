from rest_framework import serializers
from django.utils import timezone
from .models import (
    FleetAPIConfig, Vehicle, VehicleLiveData, FuelEvent,
    TripRecord, FleetAlert, MaintenanceRecord,
    VehicleCompliance, VehicleAssignment, FuelPrice, Geofence, GeofenceEvent,
    VehicleReceivingForm, KeyIssuance,
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
    project_name = serializers.CharField(source='project.name', read_only=True, allow_null=True, default=None)
    last_fuel_liters = serializers.SerializerMethodField()
    fuel_percent = serializers.SerializerMethodField()
    fuel_stats = serializers.SerializerMethodField()

    class Meta:
        model = Vehicle
        fields = '__all__'

    def get_odometer_km(self, obj):
        return round(obj.last_odometer / 1000, 2) if obj.last_odometer else 0

    def get_last_fuel_liters(self, obj):
        """Always return fuel in litres. Converts % → L using fuel_capacity when needed."""
        if obj.last_fuel is None:
            return None
        fuel = float(obj.last_fuel)
        if obj.fuel_sensor_unit == 'L':
            return round(fuel, 1)
        capacity = float(obj.fuel_capacity) if obj.fuel_capacity else 0
        if capacity > 0:
            return round(fuel / 100.0 * capacity, 1)
        return None

    def get_fuel_percent(self, obj):
        """Return current fuel as a percentage of tank capacity (0-100)."""
        liters = self.get_last_fuel_liters(obj)
        if liters is None:
            return None
        capacity = float(obj.fuel_capacity) if obj.fuel_capacity else 0
        if capacity > 0:
            return round(min(liters / capacity * 100, 100), 1)
        return None

    def get_fuel_stats(self, obj):
        """Return 24-hour fuel consumption stats computed from VehicleLiveData history."""
        from django.utils import timezone
        from datetime import timedelta
        cutoff = timezone.now() - timedelta(hours=24)
        snapshots = list(
            obj.live_data.filter(fetched_at__gte=cutoff, fuel_level__isnull=False)
            .order_by('fetched_at')
            .values('fuel_level', 'fuel_unit', 'fetched_at')
        )
        capacity = float(obj.fuel_capacity) if obj.fuel_capacity else 0

        def to_liters(level, unit):
            if level is None:
                return None
            fval = float(level)
            if unit == 'L':
                return fval
            if capacity > 0:
                return round(fval / 100.0 * capacity, 1)
            return None

        if len(snapshots) < 2:
            return {'consumed_24h': None, 'lph': None, 'refills_24h': 0}

        consumed = 0.0
        refills = 0
        DRAIN_THRESHOLD = 1.0
        FILL_THRESHOLD = 5.0
        prev_l = to_liters(snapshots[0]['fuel_level'], snapshots[0]['fuel_unit'])
        for snap in snapshots[1:]:
            curr_l = to_liters(snap['fuel_level'], snap['fuel_unit'])
            if prev_l is None or curr_l is None:
                prev_l = curr_l
                continue
            delta = curr_l - prev_l
            if delta <= -DRAIN_THRESHOLD:
                consumed += abs(delta)
            elif delta >= FILL_THRESHOLD:
                refills += 1
            prev_l = curr_l

        # Time span in hours
        first_ts = snapshots[0]['fetched_at']
        last_ts = snapshots[-1]['fetched_at']
        hours = max((last_ts - first_ts).total_seconds() / 3600, 0.1)
        lph = round(consumed / hours, 2) if consumed > 0 else None

        return {
            'consumed_24h': round(consumed, 1),
            'lph': lph,
            'refills_24h': refills,
        }

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


class KeyIssuanceSerializer(serializers.ModelSerializer):
    issued_by_name = serializers.SerializerMethodField()
    vehicle_label = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = KeyIssuance
        fields = '__all__'
        read_only_fields = ['id', 'issued_by', 'created_at']

    def get_issued_by_name(self, obj):
        if obj.issued_by:
            return obj.issued_by.get_full_name() or obj.issued_by.email
        return None

    def get_vehicle_label(self, obj):
        if obj.vehicle:
            return f"{obj.vehicle.vehicle_no}{' — ' + obj.vehicle.vehicle_name if obj.vehicle.vehicle_name else ''}"
        return None

    def get_is_overdue(self, obj):
        return obj.is_overdue()

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['issued_by'] = request.user
        return super().create(validated_data)
