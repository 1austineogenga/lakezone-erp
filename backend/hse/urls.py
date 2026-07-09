from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/',              views.HSEDashboardView.as_view()),
    path('incidents/',              views.HSEIncidentListCreate.as_view()),
    path('incidents/<uuid:pk>/',    views.HSEIncidentDetail.as_view()),
    path('toolbox-talks/',          views.ToolboxTalkListCreate.as_view()),
    path('toolbox-talks/<uuid:pk>/',views.ToolboxTalkDetail.as_view()),
    path('inductions/',             views.SiteInductionListCreate.as_view()),
    path('inductions/<uuid:pk>/',   views.SiteInductionDetail.as_view()),
    path('ppe/',                    views.PPEIssuanceListCreate.as_view()),
    path('ppe/<uuid:pk>/',          views.PPEIssuanceDetail.as_view()),
]
