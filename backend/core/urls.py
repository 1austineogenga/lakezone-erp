from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path("login/", views.LoginView.as_view(), name="login"),
    path("logout/", views.LogoutView.as_view(), name="logout"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("me/", views.MeView.as_view(), name="me"),
    path("change-password/", views.ChangePasswordView.as_view(), name="change-password"),
    path("users/", views.UserListCreateView.as_view(), name="user-list"),
    path("users/<uuid:pk>/", views.UserDetailView.as_view(), name="user-detail"),
    path("users/<uuid:pk>/reset-password/", views.ResetUserPasswordView.as_view(), name="user-reset-password"),
    path("branches/", views.BranchListCreateView.as_view(), name="branch-list"),
    path("departments/", views.DepartmentListCreateView.as_view(), name="department-list"),
    path("md-dashboard/", views.MDDashboardView.as_view(), name="md-dashboard"),
    path("reset-all-passwords/", views.ResetAllPasswordsView.as_view(), name="reset-all-passwords"),
]
