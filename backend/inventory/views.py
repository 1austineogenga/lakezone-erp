import uuid as _uuid
from django.db.models import Sum, Count
from rest_framework import generics, permissions
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied
from core.permissions import IsStorekeeper
from .models import Store, StockItem, StockLevel, StockTransaction, Asset, AssetMaintenanceLog
from .serializers import (
    StoreSerializer, StockItemSerializer, StockLevelSerializer,
    StockTransactionSerializer, AssetSerializer, AssetMaintenanceLogSerializer,
)

# ── Role sets ─────────────────────────────────────────────────────────────────

# These roles can see all departments but cannot write anything
VIEW_ALL_READONLY_ROLES = {
    'managing_director', 'finance_officer', 'finance_manager',
    'general_manager', 'head_of_security',
}

# Only system_admin sees all departments in inventory
# admin_officer and facility_manager are scoped to their own department
VIEW_ALL_ROLES = {'system_admin'} | VIEW_ALL_READONLY_ROLES

# Maps user role → store name they own
ROLE_STORE_MAP = {
    'facility_manager':     'General Store',
    'general_manager':      'General Store',
    'equipment_operator':   'General Store',
    'driver':               'General Store',
    'head_of_security':     'General Store',
    'surveillance_officer': 'General Store',
    'chef':                 'General Store',
    'cleaner':              'General Store',
    'storekeeper':          'General Store',
    'fleet_manager':        'General Store',
    'admin_officer':        'Admin Store',
    'sales_officer':        'Admin Store',
    'hr_manager':           'HR Store',
    'finance_officer':      'Finance Store',
    'finance_manager':      'Finance Store',
    'system_admin':         'IT Store',
    'site_manager':         'Site Store',
    'site_engineer':        'Site Store',
    'site_foreman':         'Site Store',
    'site_surveyor':        'Site Store',
    'mechanic':             'Site Store',
    'welder':               'Site Store',
    'project_manager':      'Site Store',
    'procurement_officer':  'Procurement Store',
}

# Roles that can see all stores (no store restriction)
VIEW_ALL_STORES = {'managing_director', 'system_admin'}


def get_user_store(user):
    """Return the Store object for this user's role, or None if not found."""
    store_name = ROLE_STORE_MAP.get(getattr(user, 'role', None))
    if not store_name:
        return None
    try:
        return Store.objects.get(name=store_name, is_active=True)
    except Store.DoesNotExist:
        return None


def _can_edit(user):
    """True if the user may add/edit inventory records at all (within their permitted scope)."""
    return user.role not in VIEW_ALL_READONLY_ROLES


def _can_edit_anywhere(user):
    """True only for system_admin — can write to any department."""
    return user.role == 'system_admin'


def _user_dept_name(user):
    return user.department.name if user.department else None


# ── Store ─────────────────────────────────────────────────────────────────────

class StoreListCreateView(generics.ListCreateAPIView):
    queryset = Store.objects.filter(is_active=True)
    serializer_class = StoreSerializer

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.IsAuthenticated()]
        return [IsStorekeeper()]


class StoreDetailView(generics.RetrieveAPIView):
    queryset = Store.objects.filter(is_active=True)
    serializer_class = StoreSerializer
    permission_classes = [permissions.IsAuthenticated]


# ── Stock Items ───────────────────────────────────────────────────────────────

class StockItemListCreateView(generics.ListCreateAPIView):
    serializer_class = StockItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)
        qs = StockItem.objects.filter(is_active=True).prefetch_related('stock_levels').select_related('department', 'created_by')
        if role in VIEW_ALL_STORES:
            store_id = self.request.query_params.get('store')
            if store_id:
                qs = qs.filter(stock_levels__store_id=store_id).distinct()
        else:
            user_store = get_user_store(user)
            if user_store:
                qs = qs.filter(stock_levels__store=user_store).distinct()
            else:
                qs = qs.none()
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if not _can_edit(user):
            raise PermissionDenied('You do not have permission to add stock items.')
        item = serializer.save(created_by=user)
        # Auto-create a StockLevel for the user's store (qty=0) if one doesn't exist
        user_store = get_user_store(user)
        if user_store:
            StockLevel.objects.get_or_create(item=item, store=user_store, defaults={'quantity': 0})


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
        if not _can_edit_anywhere(user):
            user_store = get_user_store(user)
            if not user_store or not item.stock_levels.filter(store=user_store).exists():
                raise PermissionDenied("You can only edit stock items in your own store.")
        return super().update(request, *args, **kwargs)


# ── Stock Levels ──────────────────────────────────────────────────────────────

class StockLevelListView(generics.ListAPIView):
    serializer_class = StockLevelSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['store', 'item']

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)
        qs = StockLevel.objects.select_related('item', 'store', 'item__department', 'item__created_by').all()
        if role in VIEW_ALL_STORES:
            store_id = self.request.query_params.get('store')
            if store_id:
                qs = qs.filter(store_id=store_id)
        else:
            user_store = get_user_store(user)
            if user_store:
                qs = qs.filter(store=user_store)
            else:
                qs = qs.none()
        return qs


class LowStockItemsView(generics.ListAPIView):
    serializer_class = StockItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)
        items = StockItem.objects.filter(is_active=True).prefetch_related('stock_levels').select_related('department')
        if role in VIEW_ALL_STORES:
            store_id = self.request.query_params.get('store')
            if store_id:
                items = items.filter(stock_levels__store_id=store_id).distinct()
        else:
            user_store = get_user_store(user)
            if user_store:
                items = items.filter(stock_levels__store=user_store).distinct()
            else:
                return StockItem.objects.none()
        low_pks = [it.pk for it in items if float(it.current_stock()) <= float(it.reorder_level)]
        return StockItem.objects.filter(pk__in=low_pks).prefetch_related('stock_levels')


# ── Stock Transactions ────────────────────────────────────────────────────────

class StockTransactionListCreateView(generics.ListCreateAPIView):
    serializer_class = StockTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['transaction_type', 'store', 'project', 'item']
    search_fields = ['reference_number']
    ordering_fields = ['transaction_date']

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)
        qs = StockTransaction.objects.select_related(
            'item', 'store', 'project', 'processed_by', 'item__department'
        )
        if role in VIEW_ALL_STORES:
            store_id = self.request.query_params.get('store')
            if store_id:
                qs = qs.filter(store_id=store_id)
        else:
            user_store = get_user_store(user)
            if user_store:
                qs = qs.filter(store=user_store)
            else:
                qs = qs.none()
        issued_to = self.request.query_params.get('issued_to')
        if issued_to:
            qs = qs.filter(issued_to=issued_to)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if not _can_edit(user):
            raise PermissionDenied('You do not have permission to record stock movements.')
        # Auto-set store to user's store unless system_admin passed an explicit store
        if not _can_edit_anywhere(user) or not serializer.validated_data.get('store'):
            user_store = get_user_store(user)
            if not user_store:
                raise PermissionDenied('Your role is not assigned to a store.')
            serializer.validated_data['store'] = user_store
        if not serializer.validated_data.get('reference_number'):
            prefix = serializer.validated_data.get('transaction_type', 'TXN').upper()
            serializer.validated_data['reference_number'] = f"{prefix}-{_uuid.uuid4().hex[:8].upper()}"
        serializer.save(processed_by=user)


class StockTransactionDetailView(generics.RetrieveAPIView):
    queryset = StockTransaction.objects.all()
    serializer_class = StockTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]


# ── Fixed Assets ──────────────────────────────────────────────────────────────

class AssetPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 1000

class AssetListCreateView(generics.ListCreateAPIView):
    serializer_class = AssetSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = AssetPagination
    filterset_fields = ['category', 'status', 'condition']
    search_fields = ['name', 'asset_code', 'serial_number', 'assigned_to']

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)
        qs = Asset.objects.prefetch_related('maintenance_logs').all()
        if role in VIEW_ALL_ROLES:
            dept_name = self.request.query_params.get('department')
            if dept_name:
                qs = qs.filter(department=dept_name)
        else:
            dept_name = _user_dept_name(user)
            qs = qs.filter(department=dept_name) if dept_name else qs.none()
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if not _can_edit(user):
            raise PermissionDenied('You do not have permission to add assets.')
        if _can_edit_anywhere(user):
            serializer.save()
        else:
            # admin_officer and dept users: forced to own department
            dept_name = _user_dept_name(user)
            if not dept_name:
                raise PermissionDenied('Your account is not linked to a department.')
            serializer.save(department=dept_name)


class AssetDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Asset.objects.prefetch_related('maintenance_logs').all()
    serializer_class = AssetSerializer
    permission_classes = [permissions.IsAuthenticated]

    def update(self, request, *args, **kwargs):
        user = request.user
        if not _can_edit(user):
            raise PermissionDenied('You do not have permission to edit assets.')
        asset = self.get_object()
        if not _can_edit_anywhere(user) and asset.department != _user_dept_name(user):
            raise PermissionDenied("You can only edit your own department's assets.")
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        user = request.user
        if not _can_edit(user):
            raise PermissionDenied('You do not have permission to delete assets.')
        asset = self.get_object()
        if not _can_edit_anywhere(user) and asset.department != _user_dept_name(user):
            raise PermissionDenied("You can only delete your own department's assets.")
        return super().destroy(request, *args, **kwargs)


class AssetMaintenanceListCreateView(generics.ListCreateAPIView):
    serializer_class = AssetMaintenanceLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return AssetMaintenanceLog.objects.filter(asset_id=self.kwargs['asset_pk'])

    def perform_create(self, serializer):
        user = self.request.user
        if not _can_edit(user):
            raise PermissionDenied('You do not have permission to add maintenance logs.')
        asset = Asset.objects.get(pk=self.kwargs['asset_pk'])
        if not _can_edit_anywhere(user) and asset.department != _user_dept_name(user):
            raise PermissionDenied("You can only log maintenance for your own department's assets.")
        serializer.save(asset=asset)


class AssetDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        role = getattr(user, 'role', None)
        qs = Asset.objects.all()
        if role not in VIEW_ALL_ROLES:
            dept_name = _user_dept_name(user)
            qs = qs.filter(department=dept_name) if dept_name else qs.none()

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
