# Fleet Module Redesign Documentation

## Overview

The fleet module has been comprehensively redesigned to provide a user-friendly, feature-rich interface for fleet management with enhanced fuel tracking, cost calculations, geofence management, and Kenya-specific fuel pricing integration.

## Key Features

### 1. **Fuel Management with Cost Tracking**

#### Models Enhanced
- **FuelEvent**: Now includes `price_per_litre` and `total_cost` fields
  - Automatically calculates cost based on current fuel prices
  - Supports fill, drain, and theft event types
  - All fuel values standardized to **litres (L)**

#### Fuel Price Integration
- **FuelPrice Model**: Tracks fuel prices by type and location
  - Fuel types: Diesel, Petrol (Super), Kerosene
  - Locations: Nairobi, Mombasa, Kisumu, Nakuru, Eldoret (extensible)
  - Effective date tracking for historical price changes
  - Unique constraint on (fuel_type, location, effective_date)

#### Cost Calculation Logic
- Fuel prices are automatically looked up when fuel events are created
- Lookup hierarchy:
  1. Specific location price for the fuel type
  2. Nairobi default price for the fuel type
  3. Any available price for the fuel type
- Total cost = fuel_change × price_per_litre

### 2. **Geofence Management**

#### Models
- **Geofence**: Defines geographic boundaries
  - Types: Circle (center + radius) or Polygon (multiple coordinates)
  - Active/inactive toggle for easy control
  - Description and metadata support

- **GeofenceEvent**: Tracks vehicle geofence interactions
  - Event types: Entry, Exit
  - Timestamp and location coordinates
  - Vehicle and geofence references
  - Automatic alert generation

#### Geofence Detection Algorithm
- **Point-in-Circle**: Uses Haversine formula for accurate distance calculation
  - Radius in metres
  - Accounts for Earth's curvature

- **Point-in-Polygon**: Ray casting algorithm
  - Supports complex boundary shapes
  - Efficient for multiple vehicles

#### Automatic Alert Generation
- Geofence entry/exit events trigger FleetAlert records
- Severity: MEDIUM
- Helps monitor vehicle movements and unauthorized access

### 3. **Enhanced Fuel Reporting**

#### Report Endpoints
- `GET /api/v1/fleet/fuel-report/` - Comprehensive fuel report
  - Filters: date_from, date_to, vehicle
  - Returns per-vehicle metrics:
    - Total fills/drains count
    - Total fuel added/drained (litres)
    - Total fuel added/drained cost (KSh)
    - Net consumption (litres)
    - Net cost (KSh)

#### Frontend Components

**EnhancedFuelReportPage.jsx**
- Date range filtering (default: 90 days)
- Vehicle selection
- Location-based fuel price display
- Summary cards showing:
  - Total fills/drains
  - Volume metrics
  - Cost metrics
  - Average cost per litre
- Interactive charts:
  - Volume by vehicle (bar chart)
  - Cost by vehicle (bar chart)
- Detailed event tables:
  - Fill events with cost breakdown
  - Drain/theft events with cost impact
- Current fuel prices widget showing live prices for selected location

### 4. **Geofence Management Interface**

**GeofenceManagementPage.jsx**
- Create new geofences (circle or polygon)
- Edit existing geofences
- Delete geofences
- View recent geofence events
- Filter by geofence type and status
- Real-time event tracking

### 5. **Fuel Price Management Interface**

**FuelPriceManagementPage.jsx**
- Add new fuel prices
- Edit existing prices
- Delete outdated prices
- Filter by fuel type and location
- Effective date management
- Supports all Kenya locations

## API Endpoints

### Fuel Prices
```
GET    /api/v1/fleet/fuel-prices/
POST   /api/v1/fleet/fuel-prices/
GET    /api/v1/fleet/fuel-prices/current/?location=Nairobi
GET    /api/v1/fleet/fuel-prices/<id>/
PATCH  /api/v1/fleet/fuel-prices/<id>/
DELETE /api/v1/fleet/fuel-prices/<id>/
```

### Geofences
```
GET    /api/v1/fleet/geofences/
POST   /api/v1/fleet/geofences/
GET    /api/v1/fleet/geofences/<id>/
PATCH  /api/v1/fleet/geofences/<id>/
DELETE /api/v1/fleet/geofences/<id>/
```

### Geofence Events
```
GET    /api/v1/fleet/geofence-events/?vehicle=<id>&geofence=<id>&date_from=<date>&date_to=<date>
```

### Fuel Reports
```
GET    /api/v1/fleet/fuel-report/?date_from=<date>&date_to=<date>&vehicle=<id>
```

## Data Models

### FuelPrice
```python
{
    "id": 1,
    "fuel_type": "diesel",  # diesel, petrol, kerosene
    "location": "Nairobi",
    "price_per_litre": 189.50,
    "effective_date": "2026-06-28",
    "created_at": "2026-06-28T10:00:00Z",
    "updated_at": "2026-06-28T10:00:00Z"
}
```

### Geofence
```python
{
    "id": "uuid",
    "name": "Nairobi Office",
    "description": "Company headquarters geofence",
    "geofence_type": "circle",  # circle or polygon
    "coordinates": {
        "lat": -1.2921,
        "lng": 36.8219,
        "radius": 500  # metres for circle
    },
    "is_active": true,
    "created_at": "2026-06-28T10:00:00Z",
    "updated_at": "2026-06-28T10:00:00Z"
}
```

### GeofenceEvent
```python
{
    "id": "uuid",
    "vehicle": "vehicle_id",
    "vehicle_no": "KBW-123-A",
    "geofence": "geofence_id",
    "geofence_name": "Nairobi Office",
    "event_type": "entry",  # entry or exit
    "occurred_at": "2026-06-28T10:30:00Z",
    "latitude": -1.2920,
    "longitude": 36.8220,
    "message": "KBW-123-A entered geofence Nairobi Office",
    "created_at": "2026-06-28T10:30:05Z"
}
```

### FuelEvent (Enhanced)
```python
{
    "id": 1,
    "vehicle": "vehicle_id",
    "vehicle_no": "KBW-123-A",
    "event_type": "fill",  # fill, drain, theft
    "occurred_at": "2026-06-28T10:00:00Z",
    "location_name": "Nairobi",
    "latitude": -1.2921,
    "longitude": 36.8219,
    "fuel_before": 45.5,
    "fuel_after": 65.0,
    "fuel_change": 19.5,
    "fuel_unit": "L",
    "price_per_litre": 189.50,
    "total_cost": 3695.25,
    "notes": "Regular refill at Shell station",
    "created_at": "2026-06-28T10:05:00Z"
}
```

## Database Migrations

Migration file: `fleet/migrations/0006_geofence_fuelevent_price_per_litre_and_more.py`

Changes:
- Create Geofence model
- Create GeofenceEvent model
- Create FuelPrice model
- Add price_per_litre field to FuelEvent
- Add total_cost field to FuelEvent
- Alter field types for decimal precision

## Service Layer Enhancements

### FleetSyncService

#### New Methods
- `_get_fuel_price_for_event()`: Lookup fuel price for a specific event
- `_is_point_in_polygon()`: Ray casting algorithm for polygon geofence detection
- `_is_point_in_circle()`: Haversine formula for circle geofence detection
- `_is_point_in_geofence()`: Wrapper for geofence detection
- `_detect_geofence_events()`: Detect and record geofence entry/exit events

#### Enhanced Methods
- `_detect_fuel_events()`: Now calculates and stores fuel prices and costs
- `_process_vehicle()`: Integrated geofence detection into vehicle data processing

## Frontend Components

### New Pages
1. **EnhancedFuelReportPage.jsx**
   - Comprehensive fuel analytics
   - Cost breakdowns by vehicle
   - Current fuel prices widget
   - Interactive charts and tables

2. **GeofenceManagementPage.jsx**
   - CRUD operations for geofences
   - Event tracking and visualization
   - Type and status filtering

3. **FuelPriceManagementPage.jsx**
   - CRUD operations for fuel prices
   - Location and fuel type filtering
   - Effective date management

### API Integration
New endpoints in `frontend/src/api/fleet.js`:
- `getFuelPrices()`, `createFuelPrice()`, `updateFuelPrice()`, `deleteFuelPrice()`
- `getCurrentFuelPrices()`
- `getGeofences()`, `createGeofence()`, `updateGeofence()`, `deleteGeofence()`
- `getGeofenceEvents()`

## Usage Examples

### Adding a Fuel Price
```bash
curl -X POST http://localhost:8000/api/v1/fleet/fuel-prices/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "fuel_type": "diesel",
    "location": "Nairobi",
    "price_per_litre": 189.50,
    "effective_date": "2026-06-28"
  }'
```

### Creating a Geofence
```bash
curl -X POST http://localhost:8000/api/v1/fleet/geofences/ \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nairobi Office",
    "description": "Company headquarters",
    "geofence_type": "circle",
    "coordinates": {
      "lat": -1.2921,
      "lng": 36.8219,
      "radius": 500
    },
    "is_active": true
  }'
```

### Getting Fuel Report
```bash
curl -X GET "http://localhost:8000/api/v1/fleet/fuel-report/?date_from=2026-06-01&date_to=2026-06-28" \
  -H "Authorization: Bearer <token>"
```

## Configuration

### Supported Kenya Locations
- Nairobi (default)
- Mombasa
- Kisumu
- Nakuru
- Eldoret

Extensible to additional locations by adding to the location dropdown in UI components and database.

### Fuel Types
- Diesel
- Petrol (Super)
- Kerosene

## Performance Considerations

1. **Geofence Detection**: Optimized with:
   - Pre-filtering active geofences
   - Early exit for non-matching points
   - Efficient geometric algorithms

2. **Fuel Price Lookup**: Cached with fallback hierarchy
   - Prevents repeated database queries
   - Automatic fallback to Nairobi prices

3. **Reports**: Aggregated queries with:
   - Date range filtering
   - Vehicle filtering
   - Sum aggregations for performance

## Future Enhancements

1. **Map Interface**: Interactive map for geofence creation and visualization
2. **Fuel Price API Integration**: Automatic updates from EPRA (Energy and Petroleum Regulatory Authority)
3. **Predictive Analytics**: Fuel consumption forecasting
4. **Compliance Tracking**: Automated compliance alerts and reporting
5. **Mobile App**: Native mobile interface for drivers
6. **Real-time Alerts**: WebSocket integration for instant notifications
7. **Advanced Reporting**: PDF export, scheduled email reports
8. **Multi-currency Support**: Beyond KSh
9. **Fuel Consumption Optimization**: AI-based recommendations
10. **Integration with IoT Devices**: Direct device data ingestion

## Troubleshooting

### Fuel Prices Not Showing in Reports
- Ensure FuelPrice records exist for the vehicle's fuel type
- Check effective_date is on or before the fuel event date
- Verify location matches or fallback to Nairobi is available

### Geofence Events Not Triggering
- Ensure Geofence is_active = true
- Verify coordinates are in correct format
- Check vehicle has valid latitude/longitude in live data
- Review FleetAlert records for corresponding alerts

### Cost Calculations Incorrect
- Verify fuel prices are set for the correct fuel type
- Check fuel_change values are positive for fills
- Ensure price_per_litre is not null in FuelEvent

## Support

For issues or questions:
1. Check the API documentation
2. Review the component source code
3. Check FleetAlert records for errors
4. Review Django logs for backend errors

## Version History

- **v1.0.0** (2026-06-28): Initial redesign with fuel prices, geofence, and enhanced reporting
