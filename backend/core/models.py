import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class Branch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=500)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = "branches"
        ordering = ["name"]

    def __str__(self):
        return self.name


class Department(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    branch = models.ForeignKey(Branch, on_delete=models.PROTECT, related_name="departments")
    head = models.ForeignKey(
        "User", on_delete=models.SET_NULL, null=True, blank=True, related_name="headed_departments"
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} — {self.branch.name}"


class UserRole(models.TextChoices):
    # Admin/Executive
    SYSTEM_ADMIN        = "system_admin",        "System Administrator"
    MANAGING_DIRECTOR   = "managing_director",   "Managing Director"
    GENERAL_MANAGER     = "general_manager",     "General Manager"
    # Management
    FINANCE_OFFICER     = "finance_officer",     "Finance Officer"
    HR_MANAGER          = "hr_manager",          "HR Manager"
    PROCUREMENT_OFFICER = "procurement_officer", "Procurement Officer"
    FACILITY_MANAGER    = "facility_manager",    "Facility Manager"
    ADMIN_OFFICER       = "admin_officer",       "Admin Officer"
    # Site / Technical
    SITE_MANAGER        = "site_manager",        "Site Manager"
    SITE_ENGINEER       = "site_engineer",       "Site Engineer"
    SITE_FOREMAN        = "site_foreman",        "Site Foreman"
    SITE_SURVEYOR       = "site_surveyor",       "Site Surveyor"
    # Skilled Trades
    MECHANIC            = "mechanic",            "Mechanic"
    WELDER              = "welder",              "Welder"
    # Field / Operations
    EQUIPMENT_OPERATOR  = "equipment_operator",  "Machine Operator"
    DRIVER              = "driver",              "Driver"
    HEAD_OF_SECURITY    = "head_of_security",    "Head of Security"
    SURVEILLANCE_OFFICER= "surveillance_officer","Surveillance Officer"
    # Support Staff
    CHEF                = "chef",                "Chef"
    CLEANER             = "cleaner",             "Cleaner"
    # Legacy (keep for backwards compat)
    FINANCE_MANAGER     = "finance_manager",     "Finance Manager"
    PROJECT_MANAGER     = "project_manager",     "Project Manager"
    STOREKEEPER         = "storekeeper",         "Storekeeper"
    FLEET_MANAGER       = "fleet_manager",       "Fleet Manager"
    SALES_OFFICER       = "sales_officer",       "Sales Officer"


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", UserRole.SYSTEM_ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    role = models.CharField(max_length=50, choices=UserRole.choices, default=UserRole.SITE_ENGINEER)
    branch = models.ForeignKey(
        Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name="users"
    )
    department = models.ForeignKey(
        Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="users"
    )
    phone = models.CharField(max_length=20, blank=True)
    profile_photo = models.ImageField(upload_to='profile_photos/', null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    must_change_password = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(null=True, blank=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name"]

    class Meta:
        ordering = ["first_name", "last_name"]

    def __str__(self):
        return f"{self.get_full_name()} ({self.get_role_display()})"

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def has_role(self, *roles):
        return self.role in roles


# ── Audit Log ─────────────────────────────────────────────────────────────────

class AuditLog(models.Model):
    class Action(models.TextChoices):
        CREATE = "CREATE", "Create"
        UPDATE = "UPDATE", "Update"
        DELETE = "DELETE", "Delete"

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(
        "User", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="audit_logs",
    )
    action     = models.CharField(max_length=10, choices=Action.choices)
    model_name = models.CharField(max_length=100)
    object_id  = models.CharField(max_length=100)
    timestamp  = models.DateTimeField(default=timezone.now)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    changes    = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["model_name", "object_id"]),
            models.Index(fields=["user"]),
        ]

    def __str__(self):
        return f"{self.action} {self.model_name}({self.object_id}) by {self.user} @ {self.timestamp}"
