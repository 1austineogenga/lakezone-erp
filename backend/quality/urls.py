from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/',           views.QCDashboardView.as_view()),
    path('inspections/',         views.QualityInspectionListCreate.as_view()),
    path('inspections/<uuid:pk>/',views.QualityInspectionDetail.as_view()),
    path('ncrs/',                views.NCRListCreate.as_view()),
    path('ncrs/<uuid:pk>/',      views.NCRDetail.as_view()),
    path('tests/',               views.MaterialTestListCreate.as_view()),
    path('tests/<uuid:pk>/',     views.MaterialTestDetail.as_view()),
    path('punch-list/',          views.PunchListItemListCreate.as_view()),
    path('punch-list/<uuid:pk>/',views.PunchListItemDetail.as_view()),
]
