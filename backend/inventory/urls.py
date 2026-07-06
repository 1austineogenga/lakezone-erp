from django.urls import path
from . import views

urlpatterns = [
    path("branches/", views.BranchListView.as_view(), name="inventory-branches"),
    path("stores/", views.StoreListCreateView.as_view(), name="store-list"),
    path("stores/<uuid:pk>/", views.StoreDetailView.as_view(), name="store-detail"),
    path("items/", views.StockItemListCreateView.as_view(), name="stockitem-list"),
    path("items/low-stock/", views.LowStockItemsView.as_view(), name="stockitem-low-stock"),
    path("items/<uuid:pk>/", views.StockItemDetailView.as_view(), name="stockitem-detail"),
    path("levels/", views.StockLevelListView.as_view(), name="stocklevel-list"),
    path("transactions/", views.StockTransactionListCreateView.as_view(), name="stocktransaction-list"),
    path("transactions/<uuid:pk>/", views.StockTransactionDetailView.as_view(), name="stocktransaction-detail"),
    # Store browse (for request form — any authenticated user)
    path("stores/<uuid:store_pk>/items/", views.StoreItemsBrowseView.as_view(), name="store-items-browse"),
    # Store Requests
    path("store-requests/", views.StoreRequestListCreateView.as_view(), name="storerequest-list"),
    path("store-requests/<uuid:pk>/", views.StoreRequestDetailView.as_view(), name="storerequest-detail"),
    path("store-requests/<uuid:pk>/approve/", views.StoreRequestApproveView.as_view(), name="storerequest-approve"),
    path("store-requests/<uuid:pk>/reject/", views.StoreRequestRejectView.as_view(), name="storerequest-reject"),
    path("store-requests/<uuid:pk>/dispatch/", views.StoreRequestDispatchView.as_view(), name="storerequest-dispatch"),
    path("store-requests/<uuid:pk>/receive/", views.StoreRequestReceiveView.as_view(), name="storerequest-receive"),
    path("store-requests/<uuid:pk>/return/", views.StoreRequestReturnView.as_view(), name="storerequest-return"),
    path("store-requests/<uuid:pk>/cancel/", views.StoreRequestCancelView.as_view(), name="storerequest-cancel"),
    # Fixed Assets Register
    path("assets/dashboard/", views.AssetDashboardView.as_view(), name="asset-dashboard"),
    path("assets/", views.AssetListCreateView.as_view(), name="asset-list"),
    path("assets/<uuid:pk>/", views.AssetDetailView.as_view(), name="asset-detail"),
    path("assets/<uuid:asset_pk>/maintenance/", views.AssetMaintenanceListCreateView.as_view(), name="asset-maintenance-list"),
]
