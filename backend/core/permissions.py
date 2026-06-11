from rest_framework.permissions import BasePermission
from .models import UserRole


class HasRole(BasePermission):
    """
    Usage:  permission_classes = [HasRole('project_manager', 'system_admin')]
    Factory that returns a permission class checking for any of the given roles.
    """

    def __init__(self, *roles):
        self.roles = roles

    def __call__(self):
        return self

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in self.roles
        )


def role_permission(*roles):
    """Shorthand to build a HasRole permission class inline."""

    class _RolePermission(BasePermission):
        allowed_roles = roles

        def has_permission(self, request, view):
            return bool(
                request.user
                and request.user.is_authenticated
                and request.user.role in self.allowed_roles
            )

    return _RolePermission


# Pre-built role permission classes for common checks
IsSystemAdmin = role_permission(UserRole.SYSTEM_ADMIN)
IsManagingDirector = role_permission(UserRole.MANAGING_DIRECTOR, UserRole.SYSTEM_ADMIN)
IsFinanceManager = role_permission(UserRole.FINANCE_MANAGER, UserRole.SYSTEM_ADMIN)
IsHRManager = role_permission(UserRole.HR_MANAGER, UserRole.SYSTEM_ADMIN)
IsProjectManager = role_permission(
    UserRole.PROJECT_MANAGER, UserRole.SYSTEM_ADMIN, UserRole.MANAGING_DIRECTOR
)
IsProcurementOfficer = role_permission(UserRole.PROCUREMENT_OFFICER, UserRole.SYSTEM_ADMIN)
IsStorekeeper = role_permission(UserRole.STOREKEEPER, UserRole.SYSTEM_ADMIN)
IsFleetManager = role_permission(UserRole.FLEET_MANAGER, UserRole.SYSTEM_ADMIN)
IsSalesOfficer = role_permission(UserRole.SALES_OFFICER, UserRole.SYSTEM_ADMIN)

# Management tier — can approve across modules
IsManagement = role_permission(
    UserRole.SYSTEM_ADMIN,
    UserRole.MANAGING_DIRECTOR,
    UserRole.FINANCE_MANAGER,
    UserRole.HR_MANAGER,
)
