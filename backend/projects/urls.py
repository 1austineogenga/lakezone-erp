from django.urls import path
from . import views

urlpatterns = [
    # Projects
    path("", views.ProjectListCreateView.as_view(), name="project-list"),
    path("<uuid:pk>/", views.ProjectDetailView.as_view(), name="project-detail"),
    path("<uuid:pk>/boq/", views.BOQListView.as_view(), name="project-boq"),
    path("<uuid:pk>/boq/upload/", views.BOQUploadView.as_view(), name="project-boq-upload"),
    path("<uuid:pk>/costing/", views.ProjectCostingView.as_view(), name="project-costing"),
    path("<uuid:pk>/progress/", views.ProjectProgressView.as_view(), name="project-progress"),
    path("<uuid:pk>/documents/", views.ProjectDocumentView.as_view(), name="project-documents"),

    # Tenders (nested under project)
    path("<uuid:project_pk>/tenders/", views.TenderListCreateView.as_view(), name="tender-list"),
]
