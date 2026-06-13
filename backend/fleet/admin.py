from django.contrib import admin
from .models import (
    FleetAPIConfig, Vehicle, VehicleLiveData, FuelEvent,
    TripRecord, FleetAlert, MaintenanceRecord,
)


@admin.register(FleetAPIConfig)
class FleetAPIConfigAdmin(admin.ModelAdmin):
    list_display = ['id', 'api_type', 'base_url', 'username', 'company_name', 'project_id', 'is_active', 'last_sync_at']
    list_filter = ['api_type', 'is_active']
    search_fields = ['base_url', 'username', 'company_name']


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ['vehicle_no', 'vehicle_name', 'vehicle_type', 'fuel_type', 'last_status', 'last_speed', 'last_fuel', 'last_seen', 'is_active']
    list_filter = ['vehicle_type', 'fuel_type', 'last_status', 'is_active']
    search_fields = ['vehicle_no', 'vehicle_name', 'imei']
    raw_id_fields = ['api_config']


@admin.register(VehicleLiveData)
class VehicleLiveDataAdmin(admin.ModelAdmin):
    list_display = ['vehicle', 'fetched_at', 'status', 'speed', 'fuel_level', 'odometer', 'ignition_on', 'gps_on']
    list_filter = ['status', 'ignition_on']
    search_fields = ['vehicle__vehicle_no']
    date_hierarchy = 'fetched_at'


@admin.register(FuelEvent)
class FuelEventAdmin(admin.ModelAdmin):
    list_display = ['vehicle', 'event_type', 'occurred_at', 'fuel_before', 'fuel_after', 'fuel_change', 'location_name']
    list_filter = ['event_type']
    search_fields = ['vehicle__vehicle_no', 'location_name']
    date_hierarchy = 'occurred_at'


@admin.register(TripRecord)
class TripRecordAdmin(admin.ModelAdmin):
    list_display = ['vehicle', 'started_at', 'ended_at', 'distance_km', 'duration_minutes', 'max_speed', 'driver_name']
    list_filter = ['vehicle__vehicle_type']
    search_fields = ['vehicle__vehicle_no', 'driver_name']
    date_hierarchy = 'started_at'


@admin.register(FleetAlert)
class FleetAlertAdmin(admin.ModelAdmin):
    list_display = ['vehicle', 'alert_type', 'severity', 'occurred_at', 'acknowledged', 'acknowledged_by']
    list_filter = ['alert_type', 'severity', 'acknowledged']
    search_fields = ['vehicle__vehicle_no', 'message']
    date_hierarchy = 'occurred_at'
    actions = ['acknowledge_selected']

    def acknowledge_selected(self, request, queryset):
        from django.utils import timezone
        queryset.update(acknowledged=True, acknowledged_by=request.user, acknowledged_at=timezone.now())
    acknowledge_selected.short_description = 'Acknowledge selected alerts'


@admin.register(MaintenanceRecord)
class MaintenanceRecordAdmin(admin.ModelAdmin):
    list_display = ['vehicle', 'maintenance_type', 'date', 'cost', 'performed_by', 'next_service_date', 'created_by']
    list_filter = ['maintenance_type']
    search_fields = ['vehicle__vehicle_no', 'description', 'performed_by']
    date_hierarchy = 'date'
