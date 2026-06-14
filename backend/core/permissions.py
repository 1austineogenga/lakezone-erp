from rest_framework.permissions import BasePermission
from .models import UserRole


def role_permission(*roles):
    class _RolePermission(BasePermission):
        allowed_roles = roles

        def has_permission(self, request, view):
            return bool(
                request.user
                and request.user.is_authenticated
                and request.user.role in self.allowed_roles
            )

    return _RolePermission


# ── Tier groupings ────────────────────────────────────────────────────────────
EXEC = (
    UserRole.SYSTEM_ADMIN,
    UserRole.MANAGING_DIRECTOR,
    UserRole.GENERAL_MANAGER,
)

MANAGEMENT = EXEC + (
    UserRole.FINANCE_OFFICER, UserRole.HR_MANAGER,
    UserRole.PROCUREMENT_OFFICER, UserRole.FACILITY_MANAGER,
    UserRole.ADMIN_OFFICER,
    UserRole.FINANCE_MANAGER,  # legacy
)

SITE_STAFF = (
    UserRole.SITE_MANAGER, UserRole.SITE_ENGINEER,
    UserRole.SITE_FOREMAN, UserRole.SITE_SURVEYOR,
)

FINANCE_ROLES      = EXEC + (UserRole.FINANCE_OFFICER, UserRole.FINANCE_MANAGER)
PROCUREMENT_ROLES  = EXEC + (UserRole.PROCUREMENT_OFFICER,)
HR_ROLES           = EXEC + (UserRole.HR_MANAGER,)

# ── Pre-built permission classes ──────────────────────────────────────────────
IsSystemAdmin        = role_permission(UserRole.SYSTEM_ADMIN)
IsManagingDirector   = role_permission(*EXEC)
IsManagement         = role_permission(*MANAGEMENT)
IsFinanceManager     = role_permission(*FINANCE_ROLES)
IsHRManager          = role_permission(*HR_ROLES)
IsProcurementOfficer = role_permission(*PROCUREMENT_ROLES)
IsSiteStaff          = role_permission(*EXEC, *SITE_STAFF)
IsStorekeeper        = role_permission(UserRole.STOREKEEPER, UserRole.SYSTEM_ADMIN)
IsFleetManager       = role_permission(UserRole.FLEET_MANAGER, UserRole.SYSTEM_ADMIN)
CRM_ROLES = EXEC + (UserRole.SALES_OFFICER,)
IsSalesOfficer = role_permission(*CRM_ROLES)
