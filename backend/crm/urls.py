from django.urls import path
from . import views

urlpatterns = [
    path("clients/", views.ClientListCreateView.as_view(), name="client-list"),
    path("clients/<uuid:pk>/", views.ClientDetailView.as_view(), name="client-detail"),
    path("opportunities/", views.TenderOpportunityListCreateView.as_view(), name="opportunity-list"),
    path("opportunities/<uuid:pk>/", views.TenderOpportunityDetailView.as_view(), name="opportunity-detail"),
]
