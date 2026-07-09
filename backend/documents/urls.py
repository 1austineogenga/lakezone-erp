from django.urls import path
from . import views

urlpatterns = [
    path('dashboard/',           views.DocumentDashboardView.as_view()),
    path('drawings/',            views.DrawingListCreate.as_view()),
    path('drawings/<uuid:pk>/',  views.DrawingDetail.as_view()),
    path('rfis/',                views.RFIListCreate.as_view()),
    path('rfis/<uuid:pk>/',      views.RFIDetail.as_view()),
    path('submittals/',          views.SubmittalListCreate.as_view()),
    path('submittals/<uuid:pk>/',views.SubmittalDetail.as_view()),
]
