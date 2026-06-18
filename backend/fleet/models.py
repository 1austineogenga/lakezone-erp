import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class FleetAPIConfig(models.Model):
    API_TYPE_CHOICES = [
        ('vehicle_wise', 'Vehicle Wise'),
        ('token_based', 'Token Based'),
    ]
    api_type = models.CharField(max_length=20, choices=API_TYPE_CHOICES, default='token_based')
    base_url = models.CharField(max_length=255)
    username = models.CharField(max_length=100)
    password = models.CharField(max_length=100)
    company_name = models.CharField(max_length=200, blank=True)
    project_id = models.IntegerField(default=37)
    is_active = models.BooleanField(default=True)
    cached_token = models.TextField(blank=True)
    token_fetched_at = models.DateTimeField(null=True, blank=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Fleet API Config'
        verbose_name_plural = 'Fleet API Configs'

    def __str__(self):
        return f"{self.get_api_type_display()} - {self.base_url}"


class Vehicle(models.Model):
    FUEL_TYPE_CHOICES = [
        ('diesel', 'Diesel'),
        ('petrol', 'Petrol'),
        ('electric', 'Electric'),
        ('hybrid', 'Hybrid'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle_no = models.CharField(max_length=50, unique=True)
    vehicle_name = models.CharField(max_length=200, blank=True)
    imei = models.CharField(max_length=50, blank=True)
    vehicle_type = models.CharField(max_length=50, blank=True)
    make = models.CharField(max_length=100, blank=True)
    model_name = models.CharField(max_length=100, blank=True)
    year = models.IntegerField(null=True, blank=True)
    color = models.CharField(max_length=50, blank=True)
    fuel_type = models.CharField(max_length=20, choices=FUEL_TYPE_CHOICES, default='diesel')
    fuel_capacity = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    project = models.ForeignKey('projects.Project', null=True, blank=True, on_delete=models.SET_NULL, related_name='vehicles')
    api_config = models.ForeignKey(FleetAPIConfig, null=True, blank=True, on_delete=models.SET_NULL, related_name='vehicles')
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    last_status = models.CharField(max_length=20, blank=True)
    last_location = models.TextField(blank=True)
    last_latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    last_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    last_speed = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    last_fuel = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    fuel_sensor_unit = models.CharField(max_length=10, default='%', blank=True)
    last_odometer = models.BigIntegerField(default=0)
    last_seen = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['vehicle_no']

    def __str__(self):
        return f"{self.vehicle_no} - {self.vehicle_name}"


class VehicleLiveData(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='live_data')
    fetched_at = models.DateTimeField(auto_now_add=True)
    device_datetime = models.DateTimeField(null=True, blank=True)
    gps_actual_time = models.DateTimeField(null=True, blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    location_name = models.TextField(blank=True)
    angle = models.IntegerField(default=0)
    status = models.CharField(max_length=20, blank=True)
    speed = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    gps_on = models.BooleanField(default=False)
    ignition_on = models.BooleanField(default=False)
    power_on = models.BooleanField(default=False)
    immobilize_state = models.CharField(max_length=20, blank=True)
    fuel_level = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    battery_percentage = models.IntegerField(null=True, blank=True)
    external_volt = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    temperature = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    odometer = models.BigIntegerField(default=0)
    sos = models.BooleanField(default=False)
    driver_name = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['-fetched_at']
        index_together = [['vehicle', 'fetched_at']]

    def __str__(self):
        return f"{self.vehicle.vehicle_no} @ {self.fetched_at}"


class FuelEvent(models.Model):
    class EventType(models.TextChoices):
        FILL = 'fill', 'Fuel Fill'
        DRAIN = 'drain', 'Fuel Drain'
        THEFT = 'theft', 'Possible Theft'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='fuel_events')
    event_type = models.CharField(max_length=10, choices=EventType.choices)
    occurred_at = models.DateTimeField()
    location_name = models.TextField(blank=True)
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    fuel_before = models.DecimalField(max_digits=6, decimal_places=2)
    fuel_after = models.DecimalField(max_digits=6, decimal_places=2)
    fuel_change = models.DecimalField(max_digits=6, decimal_places=2)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-occurred_at']

    def __str__(self):
        return f"{self.vehicle.vehicle_no} {self.event_type} @ {self.occurred_at}"


class TripRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='trips')
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)
    start_location = models.TextField(blank=True)
    end_location = models.TextField(blank=True)
    start_latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    start_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    end_latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    end_longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    start_odometer = models.BigIntegerField(default=0)
    end_odometer = models.BigIntegerField(default=0)
    distance_km = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    duration_minutes = models.IntegerField(default=0)
    max_speed = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    fuel_consumed = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    driver_name = models.CharField(max_length=200, blank=True)

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.vehicle.vehicle_no} trip {self.started_at}"


class FleetAlert(models.Model):
    class AlertType(models.TextChoices):
        SOS = 'sos', 'SOS Emergency'
        SPEEDING = 'speeding', 'Overspeeding'
        LOW_FUEL = 'low_fuel', 'Low Fuel'
        FUEL_DRAIN = 'fuel_drain', 'Fuel Drain/Theft'
        IGNITION_OFF_MOVING = 'ignition_off_moving', 'Moving Without Ignition'
        IDLE_LONG = 'idle_long', 'Long Idle'
        DEVICE_OFFLINE = 'device_offline', 'Device Offline'

    class Severity(models.TextChoices):
        LOW = 'low', 'Low'
        MEDIUM = 'medium', 'Medium'
        HIGH = 'high', 'High'
        CRITICAL = 'critical', 'Critical'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='alerts')
    alert_type = models.CharField(max_length=30, choices=AlertType.choices)
    severity = models.CharField(max_length=10, choices=Severity.choices)
    message = models.TextField()
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    occurred_at = models.DateTimeField()
    acknowledged = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='acknowledged_alerts')
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-occurred_at']

    def __str__(self):
        return f"{self.vehicle.vehicle_no} {self.alert_type} @ {self.occurred_at}"


class MaintenanceRecord(models.Model):
    class MaintenanceType(models.TextChoices):
        SERVICE = 'service', 'Routine Service'
        REPAIR = 'repair', 'Repair'
        INSPECTION = 'inspection', 'Inspection'
        TYRE = 'tyre', 'Tyre Change'
        OIL = 'oil', 'Oil Change'
        OTHER = 'other', 'Other'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='maintenance')
    maintenance_type = models.CharField(max_length=20, choices=MaintenanceType.choices)
    description = models.TextField()
    date = models.DateField()
    odometer_at_service = models.BigIntegerField(default=0)
    cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    performed_by = models.CharField(max_length=200, blank=True)
    next_service_date = models.DateField(null=True, blank=True)
    next_service_odometer = models.BigIntegerField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='maintenance_records')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.vehicle.vehicle_no} {self.maintenance_type} on {self.date}"
