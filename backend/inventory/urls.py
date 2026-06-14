from django.urls import path
from . import views

urlpatterns = [
    path("stores/", views.StoreListCreateView.as_view(), name="store-list"),
    path("items/", views.StockItemListCreateView.as_view(), name="stockitem-list"),
    path("items/low-stock/", views.LowStockItemsView.as_view(), name="stockitem-low-stock"),
    path("items/<uuid:pk>/", views.StockItemDetailView.as_view(), name="stockitem-detail"),
    path("levels/", views.StockLevelListView.as_view(), name="stocklevel-list"),
    path("transactions/", views.StockTransactionListCreateView.as_view(), name="stocktransaction-list"),
    path("transactions/<uuid:pk>/", views.StockTransactionDetailView.as_view(), name="stocktransaction-detail"),
    # Fixed Assets Register
    path("assets/dashboard/", views.AssetDashboardView.as_view(), name="asset-dashboard"),
    path("assets/", views.AssetListCreateView.as_view(), name="asset-list"),
    path("assets/<uuid:pk>/", views.AssetDetailView.as_view(), name="asset-detail"),
    path("assets/<uuid:asset_pk>/maintenance/", views.AssetMaintenanceListCreateView.as_view(), name="asset-maintenance-list"),
]
