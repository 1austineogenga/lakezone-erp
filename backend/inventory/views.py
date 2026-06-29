from django.db.models import Sum, Count, Q
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from core.permissions import IsStorekeeper
from .models import Store, StockItem, StockLevel, StockTransaction, Asset, AssetMaintenanceLog
from .serializers import (
    StoreSerializer, StockItemSerializer, StockLevelSerializer,
    StockTransactionSerializer, AssetSerializer, AssetMaintenanceLogSerializer,
)

VIEW_ALL_READONLY_ROLES = {'managing_director', 'finance_officer', 'finance_manager', 'admin_officer', 'general_manager'}
EDIT_ALL_ROLES = {'system_admin'}


def _can_edit(user):
    return user.role in EDIT_ALL_ROLES or user.role not in VIEW_ALL_READONLY_ROLES


def _user_dept_name(user):
    return user.department.name if user.department else None


class StoreListCreateView(generics.ListCreateAPIView):
    queryset = Store.objects.filter(is_active=True)
    serializer_class = StoreSerializer
    permission_classes = [IsStorekeeper]


class StockItemListCreateView(generics.ListCreateAPIView):
    serializer_class = StockItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = StockItem.objects.filter(is_active=True).prefetch_related('stock_levels').select_related('department')
        role = getattr(user, 'role', None)
        if role in EDIT_ALL_ROLES or role in VIEW_ALL_READONLY_ROLES:
            dept_id = self.request.query_params.get('department')
            if dept_id:
                qs = qs.filter(department_id=dept_id)
        else:
            qs = qs.filter(department=user.department)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if not _can_edit(user):
            raise PermissionDenied('You do not have permission to add stock items.')
        if user.role not in EDIT_ALL_ROLES:
            serializer.save(department=user.department)
        else:
            serializer.save()


class StockItemDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = StockItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return StockItem.objects.all().prefetch_related('stock_levels').select_related('department')

    def update(self, request, *args, **kwargs):
        user = request.user
        if not _can_edit(user):
            raise PermissionDenied('You do not have permission to edit stock items.')
        item = self.get_object()
        if user.role not in EDIT_ALL_ROLES and item.department != user.department:
            raise PermissionDenied('You can only edit your own department\'s stock items.')
        return super().update(request, *args, **kwargs)


class StockLevelListView(generics.ListAPIView):
    serializer_class = StockLevelSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = StockLevel.objects.select_related('item', 'store', 'item__department').all()
        role = getattr(user, 'role', None)
        if role not in EDIT_ALL_ROLES and role not in VIEW_ALL_READONLY_ROLES:
            qs = qs.filter(item__department=user.department)
        return qs


class LowStockItemsView(generics.ListAPIView):
    serializer_class = StockItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)
        items = StockItem.objects.filter(is_active=True).prefetch_related('stock_levels').select_related('department')
        if role not in EDIT_ALL_ROLES and role not in VIEW_ALL_READONLY_ROLES:
            items = items.filter(department=user.department)
        low = [item.pk for item in items if float(item.current_stock()) <= float(item.reorder_level)]
        return StockItem.objects.filter(pk__in=low).prefetch_related('stock_levels')


class StockTransactionListCreateView(generics.ListCreateAPIView):
    serializer_class = StockTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['transaction_type', 'store', 'project', 'item']
    search_fields = ['reference_number']
    ordering_fields = ['transaction_date']

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)
        qs = StockTransaction.objects.select_related('item', 'store', 'project', 'processed_by', 'item__department')
        if role not in EDIT_ALL_ROLES and role not in VIEW_ALL_READONLY_ROLES:
            qs = qs.filter(item__department=user.department)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if not _can_edit(user):
            raise PermissionDenied('You do not have permission to record stock movements.')
        item = serializer.validated_data.get('item')
        if user.role not in EDIT_ALL_ROLES and item and item.department != user.department:
            raise PermissionDenied('You can only record movements for your own department\'s items.')
        serializer.save(processed_by=user)


class StockTransactionDetailView(generics.RetrieveAPIView):
    queryset = StockTransaction.objects.all()
    serializer_class = StockTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]


# ---------------------------------------------------------------------------
# Fixed Assets Register Views
# ---------------------------------------------------------------------------

class AssetListCreateView(generics.ListCreateAPIView):
    serializer_class = AssetSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['category', 'status', 'condition']
    search_fields = ['name', 'asset_code', 'serial_number', 'assigned_to']

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)
        qs = Asset.objects.prefetch_related('maintenance_logs').all()
        if role in EDIT_ALL_ROLES or role in VIEW_ALL_READONLY_ROLES:
            dept_name = self.request.query_params.get('department')
            if dept_name:
                qs = qs.filter(department=dept_name)
        else:
            dept_name = _user_dept_name(user)
            if dept_name:
                qs = qs.filter(department=dept_name)
            else:
                qs = qs.none()
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if not _can_edit(user):
            raise PermissionDenied('You do not have permission to add assets.')
        if user.role not in EDIT_ALL_ROLES:
            dept_name = _user_dept_name(user)
            if dept_name:
                serializer.save(department=dept_name)
            else:
                raise PermissionDenied('Your account is not linked to a department.')
        else:
            serializer.save()


class AssetDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Asset.objects.prefetch_related('maintenance_logs').all()
    serializer_class = AssetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def update(self, request, *args, **kwargs):
        user = request.user
        if not _can_edit(user):
            raise PermissionDenied('You do not have permission to edit assets.')
        asset = self.get_object()
        if user.role not in EDIT_ALL_ROLES:
            dept_name = _user_dept_name(user)
            if asset.department != dept_name:
                raise PermissionDenied('You can only edit your own department\'s assets.')
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        user = request.user
        if not _can_edit(user):
            raise PermissionDenied('You do not have permission to delete assets.')
        asset = self.get_object()
        if user.role not in EDIT_ALL_ROLES:
            dept_name = _user_dept_name(user)
            if asset.department != dept_name:
                raise PermissionDenied('You can only delete your own department\'s assets.')
        return super().destroy(request, *args, **kwargs)


class AssetMaintenanceListCreateView(generics.ListCreateAPIView):
    serializer_class = AssetMaintenanceLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AssetMaintenanceLog.objects.filter(asset_id=self.kwargs['asset_pk'])

    def perform_create(self, serializer):
        asset = Asset.objects.get(pk=self.kwargs['asset_pk'])
        user = self.request.user
        if not _can_edit(user):
            raise PermissionDenied('You do not have permission to add maintenance logs.')
        if user.role not in EDIT_ALL_ROLES:
            dept_name = _user_dept_name(user)
            if asset.department != dept_name:
                raise PermissionDenied('You can only log maintenance for your own department\'s assets.')
        serializer.save(asset=asset)


class AssetDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        role = getattr(user, 'role', None)
        qs = Asset.objects.all()
        if role not in EDIT_ALL_ROLES and role not in VIEW_ALL_READONLY_ROLES:
            dept_name = _user_dept_name(user)
            if dept_name:
                qs = qs.filter(department=dept_name)
            else:
                qs = qs.none()

        total_assets = qs.count()
        total_purchase_value = qs.aggregate(v=Sum('purchase_value'))['v'] or 0
        total_current_value = qs.aggregate(v=Sum('current_value'))['v'] or 0
        active_count = qs.filter(status='active').count()
        under_repair_count = qs.filter(status='under_repair').count()
        disposed_count = qs.filter(status='disposed').count()
        lost_count = qs.filter(status='lost').count()
        by_department = list(qs.values('department').annotate(count=Count('id'), value=Sum('current_value')).order_by('department'))
        by_category = list(qs.values('category').annotate(count=Count('id'), value=Sum('current_value')).order_by('category'))
        by_condition = list(qs.values('condition').annotate(count=Count('id')).order_by('condition'))

        return Response({
            'total_assets': total_assets,
            'total_purchase_value': total_purchase_value,
            'total_current_value': total_current_value,
            'active_count': active_count,
            'under_repair_count': under_repair_count,
            'disposed_count': disposed_count,
            'lost_count': lost_count,
            'by_department': by_department,
            'by_category': by_category,
            'by_condition': by_condition,
        })
