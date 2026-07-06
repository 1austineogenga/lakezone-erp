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
    ERP_STATUS_CHOICES = [
        ('OPER', 'Operational'),
        ('NON-OPER', 'Non-Operational'),
        ('IDLE', 'Idle'),
        ('UNKNOWN', 'Unknown'),
    ]
    PRIORITY_CHOICES = [
        ('HIGH', 'High'),
        ('MEDIUM', 'Medium'),
        ('LOW', 'Low'),
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
    last_fuel = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    fuel_sensor_unit = models.CharField(max_length=10, default='%', blank=True)
    last_odometer = models.BigIntegerField(default=0)
    last_seen = models.DateTimeField(null=True, blank=True)
    # Fleet Master Register fields
    asset_no = models.IntegerField(null=True, blank=True)
    asset_category = models.CharField(max_length=100, blank=True)
    asset_sub_type = models.CharField(max_length=100, blank=True)
    chassis_number = models.CharField(max_length=100, blank=True)
    year_manufacture = models.IntegerField(null=True, blank=True)
    year_acquired = models.IntegerField(null=True, blank=True)
    current_site = models.CharField(max_length=200, blank=True)
    erp_code = models.CharField(max_length=50, blank=True)
    erp_status = models.CharField(max_length=20, choices=ERP_STATUS_CHOICES, blank=True)
    priority_flag = models.CharField(max_length=10, choices=PRIORITY_CHOICES, blank=True)
    known_defects = models.TextField(blank=True)
    required_actions = models.TextField(blank=True)
    meter_reading = models.CharField(max_length=50, blank=True)
    # Source tracking — differentiates live-tracked vehicles from asset-register-only entries
    SOURCE_CHOICES = [
        ('live',     'Live (TrackNTrace)'),
        ('register', 'Asset Register'),
        ('manual',   'Manually Added'),
    ]
    is_live = models.BooleanField(default=True, help_text='Vehicle is actively tracked in TrackNTrace/Trakzee')
    source  = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='live')

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
    fuel_level = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    fuel_unit = models.CharField(max_length=5, default='L', blank=True)
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
    fuel_before = models.DecimalField(max_digits=8, decimal_places=2)
    fuel_after = models.DecimalField(max_digits=8, decimal_places=2)
    fuel_change = models.DecimalField(max_digits=8, decimal_places=2)
    price_per_litre = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    fuel_unit = models.CharField(max_length=5, default='L', blank=True)
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
        FUEL_FILL = 'fuel_fill', 'Fuel Refill'
        FUEL_DRAIN = 'fuel_drain', 'Fuel Drain/Theft'
        IGNITION_OFF_MOVING = 'ignition_off_moving', 'Moving Without Ignition'
        IDLE_LONG = 'idle_long', 'Long Idle'
        DEVICE_OFFLINE = 'device_offline', 'Device Offline'
        INSURANCE_EXPIRY = 'insurance_expiry', 'Insurance Expiring/Expired'
        INSPECTION_EXPIRY = 'inspection_expiry', 'Inspection Cert Expiring/Expired'
        SPEED_GOV_EXPIRY = 'speed_governor_expiry', 'Speed Governor Cert Expiring/Expired'
        COMPLIANCE_ISSUE = 'compliance_issue', 'Compliance Issue'
        SERVICE_DUE = 'service_due', 'Service / Maintenance Due'
        MAINTENANCE_DUE = 'maintenance_due', 'Maintenance Due'
        GEOFENCE = 'geofence', 'Geofence Alert'

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


class VehicleCompliance(models.Model):
    class ComplianceType(models.TextChoices):
        INSURANCE = 'insurance', 'Insurance'
        INSPECTION = 'inspection', 'Inspection Certificate'
        SPEED_GOVERNOR = 'speed_governor', 'Speed Governor Certificate'

    class ComplianceStatus(models.TextChoices):
        VALID = 'valid', 'Valid'
        EXPIRING_SOON = 'expiring_soon', 'Expiring Soon'
        EXPIRED = 'expired', 'Expired'
        NOT_IN_SYSTEM = 'not_in_system', 'Not in System'
        NOT_APPLICABLE = 'not_applicable', 'N/A'
        UNKNOWN = 'unknown', 'Unknown'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='compliance')
    compliance_type = models.CharField(max_length=20, choices=ComplianceType.choices)
    expiry_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=ComplianceStatus.choices, default='unknown')
    notes = models.CharField(max_length=200, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = [('vehicle', 'compliance_type')]
        ordering = ['compliance_type']

    def __str__(self):
        return f"{self.vehicle.vehicle_no} {self.compliance_type} – {self.status}"


class VehicleAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='assignments')
    employee = models.ForeignKey(
        'hr.Employee', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='vehicle_assignments'
    )
    driver_name = models.CharField(max_length=200, blank=True)
    site = models.CharField(max_length=200, blank=True)
    is_current = models.BooleanField(default=True)
    assigned_date = models.DateField(auto_now_add=True)
    notes = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-assigned_date']

    def __str__(self):
        return f"{self.vehicle.vehicle_no} → {self.driver_name}"


class FuelPrice(models.Model):
    FUEL_TYPE_CHOICES = [
        ('diesel', 'Diesel'),
        ('petrol', 'Petrol'),
        ('kerosene', 'Kerosene'),
    ]
    fuel_type = models.CharField(max_length=20, choices=FUEL_TYPE_CHOICES)
    location = models.CharField(max_length=100, default='Nairobi')
    price_per_litre = models.DecimalField(max_digits=8, decimal_places=2)
    effective_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('fuel_type', 'location', 'effective_date')
        ordering = ['-effective_date', 'location', 'fuel_type']

    def __str__(self):
        return f"{self.get_fuel_type_display()} in {self.location} @ KSh {self.price_per_litre}/L (effective {self.effective_date})"


class Geofence(models.Model):
    GEOFENCE_TYPE_CHOICES = [
        ("circle", "Circle"),
        ("polygon", "Polygon"),
    ]
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    geofence_type = models.CharField(max_length=10, choices=GEOFENCE_TYPE_CHOICES, default="circle")
    coordinates = models.JSONField() # Stores [{'lat': x, 'lng': y}, ...] for polygon or {'lat': x, 'lng': y, 'radius': r} for circle
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class GeofenceEvent(models.Model):
    EVENT_TYPE_CHOICES = [
        ("entry", "Entry"),
        ("exit", "Exit"),
    ]
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name="geofence_events")
    geofence = models.ForeignKey(Geofence, on_delete=models.CASCADE, related_name="events")
    event_type = models.CharField(max_length=10, choices=EVENT_TYPE_CHOICES)
    occurred_at = models.DateTimeField()
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-occurred_at"]

    def __str__(self):
        return f"{self.vehicle.vehicle_no} {self.event_type} {self.geofence.name} @ {self.occurred_at}"


class VehicleReceivingForm(models.Model):
    CHECKLIST = [('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')]
    MV_CERT = [('present', 'Present'), ('not_found', 'Not Found'), ('expired', 'Expired')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Vehicle details
    vehicle = models.ForeignKey(
        Vehicle, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='receiving_forms',
    )
    vehicle_make_model     = models.CharField(max_length=200)
    registration_number    = models.CharField(max_length=50)
    chassis_number         = models.CharField(max_length=100, blank=True, default='')
    date_of_inspection     = models.DateField()
    log_number             = models.CharField(max_length=50, blank=True, default='')
    mileage                = models.DecimalField(max_digits=10, decimal_places=1, null=True, blank=True)

    # Inspection checklist
    engine_oil_level       = models.CharField(max_length=10, choices=CHECKLIST, default='ok')
    brake_system           = models.CharField(max_length=10, choices=CHECKLIST, default='ok')
    steering_suspension    = models.CharField(max_length=10, choices=CHECKLIST, default='ok')
    headlights_indicators  = models.CharField(max_length=10, choices=CHECKLIST, default='ok')
    tires_condition        = models.CharField(max_length=10, choices=CHECKLIST, default='ok')
    battery_condition      = models.CharField(max_length=10, choices=CHECKLIST, default='ok')
    cooling_system         = models.CharField(max_length=10, choices=CHECKLIST, default='ok')
    fuel_system            = models.CharField(max_length=10, choices=CHECKLIST, default='ok')
    exhaust_system         = models.CharField(max_length=10, choices=CHECKLIST, default='ok')
    body_frame_condition   = models.CharField(max_length=10, choices=CHECKLIST, default='ok')
    wipers_washers_mirrors = models.CharField(max_length=10, choices=CHECKLIST, default='ok')
    horn                   = models.CharField(max_length=10, choices=CHECKLIST, default='ok')
    tipping_hydraulic_system = models.CharField(max_length=10, choices=CHECKLIST, default='na')
    inspection_notes       = models.TextField(blank=True, default='')

    # Compliance certificates
    compliance_certificate        = models.CharField(max_length=10, choices=CHECKLIST, default='ok')
    compliance_certificate_expiry = models.DateField(null=True, blank=True)
    insurance_expiry              = models.DateField(null=True, blank=True)
    speed_governor_expiry         = models.DateField(null=True, blank=True)
    mv_inspection_cert            = models.CharField(max_length=20, choices=MV_CERT, default='present')
    mv_inspection_cert_expiry     = models.DateField(null=True, blank=True)

    # Spare parts & tools as JSON lists [{name, quantity}]
    spare_parts = models.JSONField(default=list, blank=True)
    tools       = models.JSONField(default=list, blank=True)

    # Submission
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='vehicle_receiving_forms',
    )
    notes      = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Receiving — {self.registration_number} ({self.date_of_inspection})"


class KeyIssuance(models.Model):
    CONDITION = [('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')]
    FUEL_LEVEL = [('full', 'Full'), ('three_quarter', '3/4'), ('half', '1/2'), ('quarter', '1/4'), ('empty', 'Empty')]
    REQUESTOR_CHOICES = [
        ('managing_director', 'Managing Director'),
        ('hr_manager', 'HR Manager'),
        ('admin_officer', 'Admin Officer'),
        ('project_manager', 'Project Manager'),
        ('site_manager', 'Site Manager'),
        ('other', 'Other'),
    ]
    STATUS = [('out', 'Out'), ('returned', 'Returned'), ('overdue', 'Overdue')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    vehicle = models.ForeignKey('Vehicle', null=True, blank=True, on_delete=models.SET_NULL, related_name='key_issuances')

    # Who & why
    issued_to_name = models.CharField(max_length=200)
    requested_by_name = models.CharField(max_length=200)
    requested_by_role = models.CharField(max_length=50, choices=REQUESTOR_CHOICES, default='other')
    destination = models.CharField(max_length=300)
    purpose = models.TextField(blank=True, default='')

    # Issue
    issue_datetime = models.DateTimeField()
    expected_return_datetime = models.DateTimeField()
    issue_mileage = models.DecimalField(max_digits=10, decimal_places=1, null=True, blank=True)

    # Pre-departure checklist
    pre_fuel_level = models.CharField(max_length=20, choices=FUEL_LEVEL, default='full')
    pre_engine_oil = models.CharField(max_length=10, choices=CONDITION, default='ok')
    pre_tire_condition = models.CharField(max_length=10, choices=CONDITION, default='ok')
    pre_body_condition = models.CharField(max_length=10, choices=CONDITION, default='ok')
    pre_lights = models.CharField(max_length=10, choices=CONDITION, default='ok')
    pre_brakes = models.CharField(max_length=10, choices=CONDITION, default='ok')
    pre_wipers = models.CharField(max_length=10, choices=CONDITION, default='ok')
    pre_notes = models.TextField(blank=True, default='')

    # Return
    actual_return_datetime = models.DateTimeField(null=True, blank=True)
    return_mileage = models.DecimalField(max_digits=10, decimal_places=1, null=True, blank=True)
    return_fuel_level = models.CharField(max_length=20, choices=FUEL_LEVEL, blank=True, default='')
    return_engine_oil = models.CharField(max_length=10, choices=CONDITION, blank=True, default='')
    return_tire_condition = models.CharField(max_length=10, choices=CONDITION, blank=True, default='')
    return_body_condition = models.CharField(max_length=10, choices=CONDITION, blank=True, default='')
    return_lights = models.CharField(max_length=10, choices=CONDITION, blank=True, default='')
    return_brakes = models.CharField(max_length=10, choices=CONDITION, blank=True, default='')
    return_wipers = models.CharField(max_length=10, choices=CONDITION, blank=True, default='')
    return_notes = models.TextField(blank=True, default='')
    delay_justification = models.TextField(blank=True, default='')

    status = models.CharField(max_length=20, choices=STATUS, default='out')
    issued_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='key_issuances_issued')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Key — {self.vehicle} → {self.issued_to_name} ({self.issue_datetime:%Y-%m-%d})"

    def is_overdue(self):
        if self.status == 'out' and self.expected_return_datetime:
            return timezone.now() > self.expected_return_datetime
        return False
