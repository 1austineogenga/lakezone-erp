from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView

urlpatterns = [
    path("admin/", admin.site.urls),

    # API v1
    path("api/v1/auth/", include("core.urls")),
    path("api/v1/projects/", include("projects.urls")),
    path("api/v1/procurement/", include("procurement.urls")),
    path("api/v1/inventory/", include("inventory.urls")),
    path("api/v1/crm/", include("crm.urls")),
    path("api/v1/requisitions/", include("requisitions.urls")),
    path("api/v1/finance/",      include("finance.urls")),
    path("api/v1/hr/",           include("hr.urls")),
    path("api/v1/fleet/",         include("fleet.urls")),
    path("api/v1/notifications/", include("notifications.urls")),
    path("api/v1/reports/", include("reports.urls")),
    path("api/v1/hse/",     include("hse.urls")),
    path("api/v1/quality/", include("quality.urls")),
    path("api/v1/documents/", include("documents.urls")),
    path("api/v1/deployment/", include("deployment.urls")),

    # API Docs
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
