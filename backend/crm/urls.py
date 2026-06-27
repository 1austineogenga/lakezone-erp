from django.urls import path
from . import views

urlpatterns = [
    path("clients/", views.ClientListCreateView.as_view(), name="client-list"),
    path("clients/<uuid:pk>/", views.ClientDetailView.as_view(), name="client-detail"),
    path("clients/<uuid:client_pk>/interactions/", views.ClientInteractionListCreateView.as_view(), name="client-interactions"),
    path("clients/<uuid:client_pk>/interactions/<uuid:pk>/", views.ClientInteractionDetailView.as_view(), name="client-interaction-detail"),
    path("opportunities/", views.TenderOpportunityListCreateView.as_view(), name="opportunity-list"),
    path("opportunities/<uuid:pk>/", views.TenderOpportunityDetailView.as_view(), name="opportunity-detail"),
    path("pipeline/", views.PipelineView.as_view(), name="pipeline"),
]
