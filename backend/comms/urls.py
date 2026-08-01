from django.urls import path
from . import views

urlpatterns = [
    path('conversations/', views.ConversationListCreateView.as_view()),
    path('conversations/<uuid:pk>/', views.ConversationDetailView.as_view()),
    path('conversations/<uuid:pk>/archive/', views.ConversationArchiveView.as_view()),
    path('conversations/<uuid:pk>/messages/', views.ConversationReplyView.as_view()),
    path('unread-count/', views.UnreadCountView.as_view()),
]
