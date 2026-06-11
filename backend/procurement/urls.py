from django.urls import path
from . import views

urlpatterns = [
    path("suppliers/", views.SupplierListCreateView.as_view(), name="supplier-list"),
    path("suppliers/<uuid:pk>/", views.SupplierDetailView.as_view(), name="supplier-detail"),
    path("requisitions/", views.PRListCreateView.as_view(), name="pr-list"),
    path("requisitions/<uuid:pk>/", views.PRDetailView.as_view(), name="pr-detail"),
    path("requisitions/<uuid:pk>/approve/", views.PRApproveView.as_view(), name="pr-approve"),
    path("purchase-orders/", views.POListCreateView.as_view(), name="po-list"),
    path("purchase-orders/<uuid:pk>/", views.PODetailView.as_view(), name="po-detail"),
]
