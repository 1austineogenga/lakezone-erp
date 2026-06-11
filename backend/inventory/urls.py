from django.urls import path
from . import views

urlpatterns = [
    path("stores/", views.StoreListCreateView.as_view(), name="store-list"),
    path("items/", views.StockItemListCreateView.as_view(), name="stockitem-list"),
    path("items/<uuid:pk>/", views.StockItemDetailView.as_view(), name="stockitem-detail"),
    path("levels/", views.StockLevelListView.as_view(), name="stocklevel-list"),
    path("transactions/", views.StockTransactionListCreateView.as_view(), name="stocktransaction-list"),
    path("transactions/<uuid:pk>/", views.StockTransactionDetailView.as_view(), name="stocktransaction-detail"),
]
