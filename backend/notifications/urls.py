from django.urls import path
from . import views

urlpatterns = [
    path("",                    views.NotificationListView.as_view(),        name="notification-list"),
    path("unread/",             views.unread_count,                          name="notification-unread-count"),
    path("mark-all/",           views.mark_all_read,                         name="notification-mark-all"),
    path("<str:pk>/read/",      views.mark_read,                             name="notification-mark-read"),
    path("<str:pk>/",           views.delete_notification,                   name="notification-delete"),

    # Compliance alerts
    path("compliance-alerts/",  views.compliance_alerts,                     name="compliance-alerts"),

    # Scheduled Actions
    path("actions/",            views.ScheduledActionListCreateView.as_view(), name="action-list"),
    path("actions/comments/",   views.ActionCommentCreateView.as_view(),      name="action-comment"),
    path("actions/<uuid:pk>/",  views.ScheduledActionDetailView.as_view(),    name="action-detail"),
]
