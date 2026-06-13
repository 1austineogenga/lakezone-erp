from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/', views.FleetDashboardView.as_view(), name='fleet-dashboard'),
    path('vehicles/', views.VehicleListCreateView.as_view(), name='fleet-vehicle-list'),
    path('vehicles/<uuid:pk>/', views.VehicleDetailView.as_view(), name='fleet-vehicle-detail'),
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
]
