from django.urls import path
from . import views

urlpatterns = [
    # Suppliers
    path("suppliers/", views.SupplierListCreateView.as_view(), name="supplier-list"),
    path("suppliers/<uuid:pk>/", views.SupplierDetailView.as_view(), name="supplier-detail"),
    path("suppliers/<uuid:pk>/blacklist/", views.SupplierBlacklistView.as_view(), name="supplier-blacklist"),
    path("suppliers/<uuid:pk>/reinstate/", views.SupplierReinstateView.as_view(), name="supplier-reinstate"),
    path("suppliers/<uuid:pk>/update-rating/", views.SupplierRatingUpdateView.as_view(), name="supplier-update-rating"),

    # Purchase Requisitions
    path("requisitions/", views.PRListCreateView.as_view(), name="pr-list"),
    path("requisitions/<uuid:pk>/", views.PRDetailView.as_view(), name="pr-detail"),
    path("requisitions/<uuid:pk>/approve/", views.PRApproveView.as_view(), name="pr-approve"),

    # Purchase Orders
    path("purchase-orders/", views.POListCreateView.as_view(), name="po-list"),
    path("purchase-orders/<uuid:pk>/", views.PODetailView.as_view(), name="po-detail"),
    path("purchase-orders/<uuid:pk>/send/", views.POSendView.as_view(), name="po-send"),
    path("purchase-orders/<uuid:pk>/cancel/", views.POCancelView.as_view(), name="po-cancel"),

    # Goods Received Notes
    path("grns/", views.GRNListCreateView.as_view(), name="grn-list"),
    path("grns/<uuid:pk>/", views.GRNDetailView.as_view(), name="grn-detail"),
    path("grns/<uuid:pk>/confirm/", views.GRNConfirmView.as_view(), name="grn-confirm"),
]
