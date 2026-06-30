from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, Branch, Department


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = ["id", "name", "location", "is_active"]


class DepartmentSerializer(serializers.ModelSerializer):
    branch_name = serializers.CharField(source="branch.name", read_only=True)

    class Meta:
        model = Department
        fields = ["id", "name", "branch", "branch_name", "is_active"]


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source="get_full_name", read_only=True)
    role_display = serializers.CharField(source="get_role_display", read_only=True)
    branch_name = serializers.CharField(source="branch.name", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name",
            "role", "role_display", "branch", "branch_name",
            "department", "department_name", "phone",
            "profile_photo", "is_active", "must_change_password", "date_joined",
        ]
        read_only_fields = ["id", "date_joined", "must_change_password"]


class UserCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "email", "first_name", "last_name", "role",
            "branch", "department", "phone",
        ]

    def create(self, validated_data):
        import secrets, string
        alphabet = string.ascii_letters + string.digits + '!@#$%'
        password = ''.join(secrets.choice(alphabet) for _ in range(12))
        user = User.objects.create_user(password=password, **validated_data)
        user._plain_password = password  # stash for post-create email
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True, validators=[validate_password])


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["full_name"] = user.get_full_name()
        token["email"] = user.email
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["user"] = UserSerializer(self.user).data
        return data
