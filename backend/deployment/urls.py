from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/',   views.DeploymentDashboardView.as_view()),
    path('labour/',      views.LabourDeploymentListCreate.as_view()),
    path('labour/<uuid:pk>/', views.LabourDeploymentDetail.as_view()),
    path('equipment/',   views.EquipmentDeploymentListCreate.as_view()),
    path('equipment/<uuid:pk>/', views.EquipmentDeploymentDetail.as_view()),
]
