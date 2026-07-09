from django.urls import path
from . import views

urlpatterns = [
    path('photos/',           views.SitePhotoListCreate.as_view()),
    path('photos/<uuid:pk>/', views.SitePhotoDetail.as_view()),

    path('foreman/daily/',           views.ForemanDailyListCreate.as_view()),
    path('foreman/daily/<uuid:pk>/', views.ForemanDailyDetail.as_view()),
    path('foreman/weekly/',          views.ForemanWeeklyListCreate.as_view()),
    path('foreman/weekly/<uuid:pk>/',views.ForemanWeeklyDetail.as_view()),

    path('surveyor/daily/',           views.SurveyorDailyListCreate.as_view()),
    path('surveyor/daily/<uuid:pk>/', views.SurveyorDailyDetail.as_view()),
    path('surveyor/weekly/',          views.SurveyorWeeklyListCreate.as_view()),
    path('surveyor/weekly/<uuid:pk>/',views.SurveyorWeeklyDetail.as_view()),

    path('machine/daily/',            views.MachineDailyListCreate.as_view()),
    path('machine/daily/<uuid:pk>/',  views.MachineDailyDetail.as_view()),
    path('machine/weekly/',           views.MachineWeeklyListCreate.as_view()),
    path('machine/weekly/<uuid:pk>/', views.MachineWeeklyDetail.as_view()),
]
