from django.urls import path
from . import views

urlpatterns = [
    path("",           views.NotificationListView.as_view(), name="notification-list"),
    path("unread/",    views.unread_count,                   name="notification-unread-count"),
    path("mark-all/",  views.mark_all_read,                  name="notification-mark-all"),
    path("<int:pk>/read/", views.mark_read,                  name="notification-mark-read"),
]
