from django.urls import path
from . import views

urlpatterns = [
    # Compliance Renewal Cases
    path("compliance-cases/",                  views.ComplianceCaseListCreateView.as_view(), name="compliance-case-list"),
    path("compliance-cases/<uuid:pk>/",        views.ComplianceCaseDetailView.as_view(),     name="compliance-case-detail"),
    path("compliance-cases/<uuid:pk>/advance/",views.advance_compliance_case,                name="compliance-case-advance"),
    path("compliance-cases/<uuid:pk>/bill/",   views.create_compliance_bill,                 name="compliance-case-bill"),

    path("device-token/",        views.register_device_token,                 name="device-token-register"),
    path("",                    views.NotificationListView.as_view(),        name="notification-list"),
    path("unread/",             views.unread_count,                          name="notification-unread-count"),
    path("mark-all/",           views.mark_all_read,                         name="notification-mark-all"),

    # Literal paths must come before <str:pk>/ wildcard
    path("compliance-alerts/",  views.compliance_alerts,                     name="compliance-alerts"),

    # Scheduled Actions
    path("actions/",            views.ScheduledActionListCreateView.as_view(), name="action-list"),
    path("actions/comments/",   views.ActionCommentCreateView.as_view(),      name="action-comment"),
    path("actions/<uuid:pk>/",  views.ScheduledActionDetailView.as_view(),    name="action-detail"),

    path("<str:pk>/read/",      views.mark_read,                             name="notification-mark-read"),
    path("<str:pk>/",           views.delete_notification,                   name="notification-delete"),
]
