from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend
from django.core.mail import send_mail
from django.conf import settings
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import timedelta, date
import secrets
import string
import logging
from .models import User, Branch, Department
from hr.models import Employee


class LoginRateThrottle(AnonRateThrottle):
    rate = "5/min"

logger = logging.getLogger(__name__)


def _send_welcome_email(user, password):
    """Send login credentials to a newly created user."""
    subject = 'Welcome to Lake Zone ERP — Your Login Details'
    message = f"""Hello {user.first_name},

Your account has been created on the Lake Zone Enterprises ERP system.

Here are your login details:

  Login URL:  https://erp.lakezone.ke
  Email:      {user.email}
  Password:   {password}

Please log in and change your password immediately after your first login.

If you have any issues accessing your account, contact your system administrator.

Regards,
Lake Zone Enterprises
"""
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
    except Exception as e:
        logger.error(f'Failed to send welcome email to {user.email}: {e}')


def _send_password_reset_email(user, password):
    """Send new password to user after admin-triggered reset."""
    subject = 'Lake Zone ERP — Your Password Has Been Reset'
    message = f"""Hello {user.first_name},

Your password on the Lake Zone Enterprises ERP system has been reset by an administrator.

Your new login details:

  Login URL:  https://erp.lakezone.ke
  Email:      {user.email}
  Password:   {password}

Please log in and change your password as soon as possible.

If you did not request this change, contact your system administrator immediately.

Regards,
Lake Zone Enterprises
"""
    try:
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=False,
        )
    except Exception as e:
        logger.error(f'Failed to send password reset email to {user.email}: {e}')
from .serializers import (
    UserSerializer,
    UserCreateSerializer,
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
    BranchSerializer,
    DepartmentSerializer,
)
from .permissions import IsSystemAdmin, IsManagement


class LoginView(TokenObtainPairView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]
    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data["refresh"]
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Logged out successfully."}, status=status.HTTP_200_OK)
        except Exception:
            return Response({"detail": "Invalid token."}, status=status.HTTP_400_BAD_REQUEST)


class MeView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(serializer.validated_data["old_password"]):
            return Response(
                {"old_password": "Incorrect password."}, status=status.HTTP_400_BAD_REQUEST
            )
        user.set_password(serializer.validated_data["new_password"])
        user.must_change_password = False
        user.save(update_fields=["password", "last_login", "must_change_password"])
        return Response({"detail": "Password updated successfully."})


class UserListCreateView(generics.ListCreateAPIView):
    queryset = User.objects.select_related("branch", "department").all()
    permission_classes = [IsSystemAdmin]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ["role", "branch", "department", "is_active"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return UserCreateSerializer
        return UserSerializer

    def perform_create(self, serializer):
        self._created_user = serializer.save()

    def create(self, request, *args, **kwargs):
        response = super().create(request, *args, **kwargs)
        password = getattr(self._created_user, '_plain_password', None)
        if password:
            response.data['generated_password'] = password
        # Link employee record if provided
        employee_id = request.data.get('employee_id')
        if employee_id:
            try:
                emp = Employee.objects.get(pk=employee_id)
                emp.user = self._created_user
                emp.save(update_fields=['user'])
            except Employee.DoesNotExist:
                pass
        return response


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsSystemAdmin]

    def perform_update(self, serializer):
        user = serializer.save()
        # Link or re-link employee record if provided
        employee_id = self.request.data.get('employee_id')
        if employee_id:
            try:
                # Clear any previous link for this user
                Employee.objects.filter(user=user).exclude(pk=employee_id).update(user=None)
                emp = Employee.objects.get(pk=employee_id)
                emp.user = user
                emp.save(update_fields=['user'])
            except Employee.DoesNotExist:
                pass


class ResetUserPasswordView(APIView):
    """Admin resets a user's password and receives the generated password."""
    permission_classes = [IsSystemAdmin]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        alphabet = string.ascii_letters + string.digits + '!@#$%'
        new_password = ''.join(secrets.choice(alphabet) for _ in range(12))
        user.set_password(new_password)
        user.must_change_password = True
        user.save(update_fields=['password', 'must_change_password'])
        return Response({
            'detail': f"Password reset for {user.get_full_name() or user.email}.",
            'new_password': new_password,
        })


class ResetAllPasswordsView(APIView):
    """Reset passwords for all active users and return credentials list. System admin only."""
    permission_classes = [IsSystemAdmin]

    def post(self, request):
        alphabet = string.ascii_letters + string.digits + '!@#$%'
        role_filter = request.data.get('role')
        qs = User.objects.filter(is_active=True).order_by('role', 'first_name')
        if role_filter:
            qs = qs.filter(role=role_filter)

        results = []
        for user in qs:
            pwd = ''.join(secrets.choice(alphabet) for _ in range(12))
            user.set_password(pwd)
            user.must_change_password = True
            user.save(update_fields=['password', 'must_change_password'])
            results.append({
                'full_name': user.get_full_name() or user.email,
                'email': user.email,
                'role': user.get_role_display(),
                'password': pwd,
            })

        return Response({'count': len(results), 'credentials': results})


class BranchListCreateView(generics.ListCreateAPIView):
    serializer_class = BranchSerializer

    def get_queryset(self):
        show_all = self.request.query_params.get('all') == 'true'
        if show_all:
            return Branch.objects.all()
        return Branch.objects.filter(is_active=True)

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsManagement()]


class BranchDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Branch.objects.all()
    serializer_class = BranchSerializer
    permission_classes = [IsManagement]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DepartmentListCreateView(generics.ListCreateAPIView):
    serializer_class = DepartmentSerializer

    def get_queryset(self):
        show_all = self.request.query_params.get('all') == 'true'
        qs = Department.objects.select_related("branch", "head")
        if not show_all:
            qs = qs.filter(is_active=True)
        return qs

    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsManagement()]


class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Department.objects.select_related("branch", "head").all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsManagement]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_active = False
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MDDashboardView(APIView):
    """Aggregated executive dashboard for Managing Director and System Admin."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        now = timezone.now()
        mtd_start = today.replace(day=1)
        last_30 = now - timedelta(days=30)

        # ── Finance ──────────────────────────────────────────────────────────
        try:
            from finance.models import Invoice, Bill, ExpenseClaim
            ar = Invoice.objects.aggregate(
                total_billed=Sum('total_amount'),
                total_received=Sum('amount_paid'),
                total_outstanding=Sum('balance_due'),
            )
            overdue_ar = Invoice.objects.filter(
                due_date__lt=today,
                status__in=['sent', 'certified', 'partial', 'overdue']
            ).aggregate(total=Sum('balance_due'))

            ap = Bill.objects.aggregate(
                total_billed=Sum('total_amount'),
                total_paid=Sum('amount_paid'),
                total_outstanding=Sum('balance_due'),
            )
            overdue_ap = Bill.objects.filter(
                due_date__lt=today,
                status__in=['approved', 'partial', 'overdue']
            ).aggregate(total=Sum('balance_due'))

            pending_expenses_count = ExpenseClaim.objects.filter(status='submitted').count()
            pending_expenses_value = ExpenseClaim.objects.filter(status='submitted').aggregate(
                total=Sum('total_amount'))['total'] or 0

            finance = {
                'ar_billed': float(ar['total_billed'] or 0),
                'ar_received': float(ar['total_received'] or 0),
                'ar_outstanding': float(ar['total_outstanding'] or 0),
                'ar_overdue': float(overdue_ar['total'] or 0),
                'ap_billed': float(ap['total_billed'] or 0),
                'ap_paid': float(ap['total_paid'] or 0),
                'ap_outstanding': float(ap['total_outstanding'] or 0),
                'ap_overdue': float(overdue_ap['total'] or 0),
                'pending_expenses_count': pending_expenses_count,
                'pending_expenses_value': float(pending_expenses_value),
                'collection_rate': round((float(ar['total_received'] or 0) / float(ar['total_billed'] or 1)) * 100, 1),
            }
        except Exception as e:
            logger.error(f'MD dashboard finance error: {e}')
            finance = {}

        # ── Projects ─────────────────────────────────────────────────────────
        try:
            from projects.models import Project
            all_projects = Project.objects.all()
            proj_by_status = list(all_projects.values('status').annotate(count=Count('id')))
            active_projects = all_projects.filter(status='active')
            projects = {
                'total': all_projects.count(),
                'active': active_projects.count(),
                'completed': all_projects.filter(status='completed').count(),
                'on_hold': all_projects.filter(status='on_hold').count(),
                'by_status': proj_by_status,
                'recent': list(
                    all_projects.order_by('-created_at')[:5].values(
                        'id', 'name', 'status', 'client_name', 'start_date', 'end_date'
                    )
                ),
            }
        except Exception as e:
            logger.error(f'MD dashboard projects error: {e}')
            projects = {}

        # ── Fleet ────────────────────────────────────────────────────────────
        try:
            from fleet.models import Vehicle, FleetAlert
            online_cutoff = now - timedelta(minutes=10)
            vehicles = Vehicle.objects.filter(is_active=True)
            fleet = {
                'total': vehicles.count(),
                'online': vehicles.filter(last_seen__gte=online_cutoff).count(),
                'moving': vehicles.filter(last_status='MOVING').count(),
                'idle': vehicles.filter(last_status='IDLE').count(),
                'stopped': vehicles.filter(last_status__in=['STOP', 'INACTIVE']).count(),
                'alerts_unacked': FleetAlert.objects.filter(acknowledged=False).count(),
                'low_fuel': vehicles.filter(last_fuel__isnull=False, last_fuel__lt=30).count(),
            }
        except Exception as e:
            logger.error(f'MD dashboard fleet error: {e}')
            fleet = {}

        # ── HR ───────────────────────────────────────────────────────────────
        try:
            from hr.models import Employee, LeaveApplication, AttendanceRecord
            employees = Employee.objects.filter(is_active=True)
            in_30 = today + timedelta(days=30)
            hr_data = {
                'total_employees': employees.count(),
                'staff': employees.filter(employment_type='staff').count(),
                'casuals': employees.filter(employment_type='casual').count(),
                'expiring_contracts': employees.filter(
                    contract_end_date__gte=today, contract_end_date__lte=in_30
                ).count(),
                'pending_leaves': LeaveApplication.objects.filter(status='submitted').count(),
                'present_today': AttendanceRecord.objects.filter(
                    date=today, status__in=['present', 'late']).count(),
                'on_leave_today': AttendanceRecord.objects.filter(
                    date=today, status='on_leave').count(),
            }
        except Exception as e:
            logger.error(f'MD dashboard hr error: {e}')
            hr_data = {}

        # ── Procurement ──────────────────────────────────────────────────────
        try:
            from procurement.models import PurchaseRequisition, PurchaseOrder
            procurement = {
                'pending_prs': PurchaseRequisition.objects.filter(
                    status__in=['pending', 'dept_approved', 'finance_approved']).count(),
                'approved_prs': PurchaseRequisition.objects.filter(
                    status='md_approved').count(),
                'open_pos': PurchaseOrder.objects.filter(status__in=['sent', 'partial']).count(),
                'po_value_open': float(
                    PurchaseOrder.objects.filter(
                        status__in=['sent', 'partial']
                    ).aggregate(v=Sum('total_amount'))['v'] or 0
                ),
            }
        except Exception as e:
            logger.error(f'MD dashboard procurement error: {e}')
            procurement = {}

        # ── Requisitions ─────────────────────────────────────────────────────
        try:
            from requisitions.models import StaffRequisition
            requisitions = {
                'pending': StaffRequisition.objects.filter(status='submitted').count(),
                'approved': StaffRequisition.objects.filter(status='approved').count(),
                'total_mtd': StaffRequisition.objects.filter(
                    created_at__date__gte=mtd_start).count(),
            }
        except Exception as e:
            logger.error(f'MD dashboard requisitions error: {e}')
            requisitions = {}

        # ── Inventory / Assets ───────────────────────────────────────────────
        try:
            from inventory.models import StockItem, StockLevel, Asset
            from django.db.models import F
            total_items = StockItem.objects.filter(is_active=True).count()
            low_stock = StockLevel.objects.filter(
                quantity_on_hand__lte=F('item__reorder_level'),
                item__is_active=True,
            ).values('item').distinct().count()
            inventory = {
                'total_items': total_items,
                'low_stock': low_stock,
                'total_assets': Asset.objects.count(),
                'active_assets': Asset.objects.filter(status='operational').count(),
                'under_repair': Asset.objects.filter(status='under_repair').count(),
            }
        except Exception as e:
            logger.error(f'MD dashboard inventory error: {e}')
            inventory = {}

        # ── Users ────────────────────────────────────────────────────────────
        try:
            users_data = {
                'total': User.objects.filter(is_active=True).count(),
                'by_role': list(
                    User.objects.filter(is_active=True)
                    .values('role').annotate(count=Count('id')).order_by('role')
                ),
            }
        except Exception:
            users_data = {}

        return Response({
            'finance': finance,
            'projects': projects,
            'fleet': fleet,
            'hr': hr_data,
            'procurement': procurement,
            'requisitions': requisitions,
            'inventory': inventory,
            'users': users_data,
            'generated_at': now.isoformat(),
        })
