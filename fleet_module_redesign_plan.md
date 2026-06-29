# Fleet Module Redesign Plan for Lakezone ERP

## 1. Introduction

This document outlines the proposed redesign for the fleet module within the Lakezone ERP system. The primary goal is to enhance user-friendliness, incorporate comprehensive fuel management capabilities (including live Kenya fuel prices), and improve alerting, geofencing, and compliance features. All fuel-related values will be standardized to litres.

## 2. Current System Overview

The existing fleet module provides core functionalities such as vehicle tracking, live data, fuel event logging (fills and drains), trip recording, maintenance tracking, and compliance management. It integrates with external APIs (e.g., TrackNTrace) for live vehicle data and alerts. Fuel events are already recorded in litres, and basic fuel reports are available.

## 3. Proposed Enhancements

### 3.1. Data Model Enhancements

To support the new requirements, the following additions and modifications to the existing Django models are proposed:

#### 3.1.1. `FuelPrice` Model (New)

This model will store historical and current fuel prices for different fuel types and locations.

```python
class FuelPrice(models.Model):
    FUEL_TYPE_CHOICES = [
        ('diesel', 'Diesel'),
        ('petrol', 'Petrol'),
        ('kerosene', 'Kerosene'),
    ]
    fuel_type = models.CharField(max_length=20, choices=FUEL_TYPE_CHOICES)
    location = models.CharField(max_length=100, default='Nairobi') # e.g., Nairobi, Mombasa
    price_per_litre = models.DecimalField(max_digits=8, decimal_places=2)
    effective_date = models.DateField(unique_for_date='effective_date') # Price effective from this date
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('fuel_type', 'location', 'effective_date')
        ordering = ['-effective_date', 'location', 'fuel_type']

    def __str__(self):
        return f"{self.get_fuel_type_display()} in {self.location} @ KSh {self.price_per_litre}/L (effective {self.effective_date})
```

#### 3.1.2. `FuelEvent` Model (Modification)

Add fields to store the price at the time of the event and the calculated total cost.

```python
class FuelEvent(models.Model):
    # ... existing fields ...
    price_per_litre = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    total_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    # ... existing methods ...
```

#### 3.1.3. `Geofence` Model (New)

This model will define geofence areas and associated actions.

```python
class Geofence(models.Model):
    GEOFENCE_TYPE_CHOICES = [
        ('circle', 'Circle'),
        ('polygon', 'Polygon'),
    ]
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    geofence_type = models.CharField(max_length=10, choices=GEOFENCE_TYPE_CHOICES, default='circle')
    coordinates = models.JSONField() # Stores [{'lat': x, 'lng': y}, ...] for polygon or {'lat': x, 'lng': y, 'radius': r} for circle
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
```

#### 3.1.4. `GeofenceEvent` Model (New)

This model will log events related to vehicles entering or exiting geofences.

```python
class GeofenceEvent(models.Model):
    EVENT_TYPE_CHOICES = [
        ('entry', 'Entry'),
        ('exit', 'Exit'),
    ]
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='geofence_events')
    geofence = models.ForeignKey(Geofence, on_delete=models.CASCADE, related_name='events')
    event_type = models.CharField(max_length=10, choices=EVENT_TYPE_CHOICES)
    occurred_at = models.DateTimeField()
    latitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    longitude = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-occurred_at']

    def __str__(self):
        return f"{self.vehicle.vehicle_no} {self.event_type} {self.geofence.name} @ {self.occurred_at}"
```

### 3.2. API Enhancements (Backend)

#### 3.2.1. Fuel Price Management API

*   **`GET /fleet/fuel-prices/`**: List all fuel prices, with optional filters for `fuel_type`, `location`, and `effective_date` range.
*   **`POST /fleet/fuel-prices/`**: Add a new fuel price entry. This will be used for manual updates or by a scheduled scraping service.
*   **`GET /fleet/fuel-prices/current/`**: Get the most recent fuel prices for all types and locations.
*   **`GET /fleet/fuel-prices/current/<fuel_type>/<location>/`**: Get the current price for a specific fuel type and location.

#### 3.2.2. Fuel Event API (Modification)

*   When a `FuelEvent` (fill or drain) is recorded, the system will automatically fetch the `price_per_litre` from the `FuelPrice` model based on the `occurred_at` timestamp, `fuel_type` of the vehicle, and optionally the `location` of the event. The `total_cost` will then be calculated (`fuel_change * price_per_litre`).
*   The `FuelReportView` will be updated to include cost calculations and display total fuel costs.

#### 3.2.3. Geofence Management API

*   **`GET /fleet/geofences/`**: List all defined geofences.
*   **`POST /fleet/geofences/`**: Create a new geofence.
*   **`GET /fleet/geofences/<uuid:pk>/`**: Retrieve details of a specific geofence.
*   **`PUT/PATCH /fleet/geofences/<uuid:pk>/`**: Update an existing geofence.
*   **`DELETE /fleet/geofences/<uuid:pk>/`**: Delete a geofence.
*   **`GET /fleet/geofence-events/`**: List geofence entry/exit events, with filters for `vehicle`, `geofence`, and `date` range.

#### 3.2.4. Alert System Enhancements

*   The `FleetAlert` model already supports a `GEOFENCE` alert type. The `FleetSyncService` will be extended to detect geofence entry/exit events and create corresponding `FleetAlert` entries.
*   Compliance alerts (`INSURANCE_EXPIRY`, `INSPECTION_EXPIRY`, `SPEED_GOV_EXPIRY`) are already present. The system will ensure these are actively generated and displayed.

### 3.3. UI/UX Design (Frontend)

#### 3.3.1. Redesigned Fleet Dashboard

*   **Overview Cards**: Prominent display of key metrics: total vehicles, active trips, unacknowledged alerts, total fuel consumed (litres and cost), total fuel filled (litres and cost), and net fuel balance (litres and cost).
*   **Fuel Price Widget**: A small widget showing current fuel prices (Petrol, Diesel) for the default location (e.g., Nairobi), with an option to view prices for other locations or access the full fuel price history.
*   **Alerts Summary**: Enhanced display of active alerts, categorized by severity and type (e.g., Fuel, Geofence, Compliance, Safety).
*   **Geofence Map Integration**: A map component showing vehicle locations relative to defined geofences, with visual indicators for geofence breaches.

#### 3.3.2. Enhanced Fuel Report Page

*   **Cost Breakdown**: The existing fuel report will be augmented to include total cost for fuel fills and estimated cost for fuel consumption, based on the `price_per_litre` recorded with each `FuelEvent`.
*   **Graphical Representation**: Bar charts and line graphs to visualize fuel consumption trends and costs over time.
*   **Filter Options**: Advanced filtering by vehicle, date range, fuel type, and location.

#### 3.3.3. Fuel Price Management Page (Admin)

*   A dedicated page for administrators to view, add, edit, and delete `FuelPrice` entries.
*   Ability to specify `fuel_type`, `location`, `price_per_litre`, and `effective_date`.
*   Display of historical price changes.

#### 3.3.4. Geofence Management Page

*   **Map-based Interface**: An interactive map where users can draw circular or polygonal geofences.
*   **Geofence List**: A table listing all geofences with their names, types, and active status.
*   **Event Log**: A section to view `GeofenceEvent` logs, showing vehicle entry/exit times and locations.

#### 3.3.5. Alerts Page

*   **Categorization**: Alerts will be clearly categorized (Fuel, Geofence, Compliance, Safety) for easier navigation.
*   **Detailed View**: Clicking on an alert will show more details, including location on a map (if applicable) and relevant vehicle information.

## 4. Technical Considerations

*   **Fuel Price Data Source**: Given the lack of a direct EPRA API, a scheduled task will be implemented to periodically scrape the EPRA website (e.g., `epra.go.ke/pump-prices`) for updates. This task will parse the HTML to extract the latest prices and update the `FuelPrice` model. Manual override/entry will also be supported.
*   **Geofence Detection**: Geofence entry/exit detection will be integrated into the `FleetSyncService`. When new `VehicleLiveData` is processed, it will check the vehicle's current location against all active geofences.
*   **Units**: All fuel-related inputs and outputs in the UI and API will consistently use litres.

## 5. Implementation Plan

1.  **Phase 1: Backend Data Model and API Implementation**
    *   Create `FuelPrice`, `Geofence`, and `GeofenceEvent` models.
    *   Modify `FuelEvent` model.
    *   Implement serializers and views for new models.
    *   Update `FleetSyncService` to include geofence detection and alert generation.
    *   Integrate fuel price lookup into `FuelEvent` creation and `FuelReportView`.
    *   Develop a scraping script for EPRA fuel prices (or a mechanism for manual updates).

2.  **Phase 2: Frontend UI/UX Implementation**
    *   Redesign Fleet Dashboard components.
    *   Enhance Fuel Report Page with cost data and improved visualizations.
    *   Develop Fuel Price Management Page.
    *   Develop Geofence Management Page with map integration.
    *   Update Alerts Page to display new alert types.

3.  **Phase 3: Testing and Integration**
    *   Unit and integration tests for all new and modified components.
    *   End-to-end testing of new workflows.
    *   Performance testing.

4.  **Phase 4: Deployment and Documentation**
    *   Deploy changes to a staging environment.
    *   Update user and developer documentation.

## 6. Conclusion

This redesign will significantly enhance the fleet module's capabilities, providing users with more detailed insights into fuel consumption and costs, improved geographical monitoring, and a more robust alerting system. The focus on user-friendliness and data accuracy will make the Lakezone ERP fleet module a more powerful tool for fleet management.
