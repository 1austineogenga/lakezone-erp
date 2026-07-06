from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/', views.FleetDashboardView.as_view(), name='fleet-dashboard'),
    path('vehicles/', views.VehicleListCreateView.as_view(), name='fleet-vehicle-list'),
    path('vehicles/<uuid:pk>/', views.VehicleDetailView.as_view(), name='fleet-vehicle-detail'),
    path('vehicles/<uuid:pk>/compliance/', views.VehicleComplianceView.as_view(), name='fleet-vehicle-compliance'),
    path('live/', views.FleetLiveView.as_view(), name='fleet-live'),
    path('live/<uuid:vehicle_pk>/', views.VehicleLiveView.as_view(), name='fleet-vehicle-live'),
    path('sync/', views.ForceSyncView.as_view(), name='fleet-sync'),
    path('fuel-events/', views.FuelEventListView.as_view(), name='fleet-fuel-events'),
    path('trips/', views.TripListView.as_view(), name='fleet-trips'),
    path('alerts/', views.AlertListView.as_view(), name='fleet-alerts'),
    path('alerts/<uuid:pk>/acknowledge/', views.AcknowledgeAlertView.as_view(), name='fleet-alert-acknowledge'),
    path('maintenance/', views.MaintenanceListCreateView.as_view(), name='fleet-maintenance-list'),
    path('maintenance/<uuid:pk>/', views.MaintenanceDetailView.as_view(), name='fleet-maintenance-detail'),
    path('reports/fuel/', views.FuelReportView.as_view(), name='fleet-report-fuel'),
    path('reports/utilization/', views.UtilizationReportView.as_view(), name='fleet-report-utilization'),
    path('config/', views.FleetConfigView.as_view(), name='fleet-config-list'),
    path('config/<int:pk>/', views.FleetConfigDetailView.as_view(), name='fleet-config-detail'),
    path('backfill/', views.BackfillView.as_view(), name='fleet-backfill'),
    path('fetch-history/', views.FetchHistoryView.as_view(), name='fleet-fetch-history'),
    path('fetch-fuel-events/', views.FetchFuelEventsView.as_view(), name='fleet-fetch-fuel-events'),
    path('import-register/', views.FleetRegisterImportView.as_view(), name='fleet-import-register'),
    path('fetch-alerts/', views.FetchTrackNTraceAlertsView.as_view(), name='fleet-fetch-alerts'),
    path('check-maintenance/', views.CheckMaintenanceDueView.as_view(), name='fleet-check-maintenance'),
]

urlpatterns += [
    path('debug/', views.FleetDebugView.as_view(), name='fleet-debug'),
    path('vehicle-details/', views.FetchVehicleDetailsView.as_view(), name='fleet-vehicle-details'),
]


urlpatterns += [
    path("sync-assets/",    views.SyncAssetsToFleetView.as_view(),    name="fleet-sync-assets"),
    path("fetch-erc-prices/", views.FetchErcFuelPricesView.as_view(), name="fleet-fetch-erc-prices"),
]

urlpatterns += [
    path("fuel-prices/", views.FuelPriceListCreateView.as_view(), name="fleet-fuel-price-list"),
    path("fuel-prices/current/", views.CurrentFuelPriceView.as_view(), name="fleet-fuel-price-current"),
    path("fuel-prices/<int:pk>/", views.FuelPriceDetailView.as_view(), name="fleet-fuel-price-detail"),
    path("geofences/", views.GeofenceListCreateView.as_view(), name="fleet-geofence-list"),
    path("geofences/<uuid:pk>/", views.GeofenceDetailView.as_view(), name="fleet-geofence-detail"),
    path("geofence-events/", views.GeofenceEventListView.as_view(), name="fleet-geofence-event-list"),
    path("receiving/", views.VehicleReceivingListCreateView.as_view(), name="fleet-receiving-list"),
    path("receiving/<uuid:pk>/", views.VehicleReceivingDetailView.as_view(), name="fleet-receiving-detail"),
]
