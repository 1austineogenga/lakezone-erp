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
import secrets
import string
import logging
from .models import User, Branch, Department


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
        user.save()
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
        return response


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsSystemAdmin]


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
        user.save(update_fields=['password'])
        return Response({
            'detail': f"Password reset for {user.get_full_name() or user.email}.",
            'new_password': new_password,
        })


class BranchListCreateView(generics.ListCreateAPIView):
    queryset = Branch.objects.filter(is_active=True)
    serializer_class = BranchSerializer
    permission_classes = [IsManagement]


class DepartmentListCreateView(generics.ListCreateAPIView):
    queryset = Department.objects.select_related("branch").filter(is_active=True)
    serializer_class = DepartmentSerializer
    permission_classes = [IsManagement]
