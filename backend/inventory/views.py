import uuid as _uuid
from django.db.models import Sum, Count
from rest_framework import generics, permissions
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied


class InventoryPagination(PageNumberPagination):
    page_size = 500
    page_size_query_param = 'page_size'
    max_page_size = 2000
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
    'cleaner':              'General Store',
    'storekeeper':          'General Store',
    'fleet_manager':        'General Store',
    'procurement_officer':  'General Store',
    'admin_officer':        'Admin Store',
    'sales_officer':        'Admin Store',
    'hr_manager':           'Admin Store',
    'finance_officer':      'Admin Store',
    'finance_manager':      'Admin Store',
    'system_admin':         'IT Store',
    'chef':                 'Kitchen Store',
    'site_manager':         'Site Store',
    'site_engineer':        'Site Store',
    'site_foreman':         'Site Store',
    'site_surveyor':        'Site Store',
    'mechanic':             'Site Store',
    'welder':               'Site Store',
    'project_manager':      'Site Store',
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


# ── Site locations (from projects) ────────────────────────────────────────────

class SiteListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, *args, **kwargs):
        from projects.models import Project
        locations = (
            Project.objects
            .exclude(location='')
            .exclude(location__isnull=True)
            .values_list('location', flat=True)
            .distinct()
            .order_by('location')
        )
        return Response([{'name': loc} for loc in locations])


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
    serializer_class   = StockItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class   = InventoryPagination

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)
        qs = StockItem.objects.filter(is_active=True).prefetch_related('stock_levels').select_related('department', 'branch', 'created_by')
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
        if site := self.request.query_params.get('site_location'):
            qs = qs.filter(site_location=site)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if not _can_edit(user):
            raise PermissionDenied('You do not have permission to add stock items.')
        item = serializer.save(created_by=user)
        # Auto-create a StockLevel for the user's store (qty=0) if one doesn't exist
        user_store = get_user_store(user)
        if user_store:
            StockLevel.objects.get_or_create(item=item, store=user_store, defaults={'quantity_on_hand': 0})


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
    serializer_class   = StockItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class   = InventoryPagination

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
    serializer_class   = StockTransactionSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class   = InventoryPagination
    filterset_fields   = ['transaction_type', 'store', 'project', 'item']
    search_fields      = ['reference_number']
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


# ── Store Request views ───────────────────────────────────────────────────────

import uuid as _uuid_mod
from django.utils import timezone
from django.contrib.auth import get_user_model
from .models import StoreRequest
from .serializers import (
    StoreItemBrowseSerializer,
    StoreRequestSerializer, StoreRequestListSerializer,
    StoreRequestCreateSerializer, StoreRequestApproveSerializer,
    StoreRequestRejectSerializer, StoreRequestDispatchSerializer,
    StoreRequestReceiveSerializer, StoreRequestReturnSerializer,
)


def _notify_sr(users, ntype, title, message, link):
    """Fire a notification to a list of users, swallowing errors."""
    try:
        from notifications.signals import notify
        from notifications.models import Notification
        for u in users:
            notify(u, ntype, title, message, link)
    except Exception:
        pass


def _storekeepers_for_store(store):
    """Return users who are storekeepers for the given store."""
    User = get_user_model()
    roles = [r for r, sname in ROLE_STORE_MAP.items() if sname == store.name]
    roles.append('system_admin')
    return list(User.objects.filter(role__in=roles, is_active=True))


# Read-only item list for any store — used by the request form
class StoreItemsBrowseView(generics.ListAPIView):
    serializer_class   = StoreItemBrowseSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class   = InventoryPagination

    def get_queryset(self):
        store_pk = self.kwargs['store_pk']
        return (
            StockItem.objects
            .filter(is_active=True, stock_levels__store_id=store_pk)
            .prefetch_related('stock_levels')
            .distinct()
            .order_by('name')
        )

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['store_pk'] = str(self.kwargs['store_pk'])
        return ctx


class StoreRequestListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class   = InventoryPagination

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return StoreRequestCreateSerializer
        return StoreRequestListSerializer

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)
        view = self.request.query_params.get('view', '')

        qs = StoreRequest.objects.select_related(
            'item', 'source_store', 'destination_store',
            'requested_by', 'approved_by', 'dispatched_by', 'received_by',
        )

        if role in VIEW_ALL_ROLES:
            # MD / system_admin see everything; filter by view param
            if view == 'incoming':
                user_store = get_user_store(user)
                if user_store:
                    qs = qs.filter(source_store=user_store)
            elif view == 'outgoing':
                qs = qs.filter(requested_by=user)
            elif view == 'receipts':
                qs = qs.filter(requested_by=user, status=StoreRequest.Status.DISPATCHED)
            # else return all
            return qs

        user_store = get_user_store(user)
        can_write = _can_edit(user)

        if view == 'incoming' and can_write and user_store:
            return qs.filter(source_store=user_store)
        if view == 'outgoing':
            return qs.filter(requested_by=user)
        if view == 'receipts':
            return qs.filter(requested_by=user, status=StoreRequest.Status.DISPATCHED)

        # default: storekeeper sees incoming to their store + their own requests
        if can_write and user_store:
            from django.db.models import Q
            return qs.filter(
                Q(source_store=user_store) | Q(requested_by=user)
            ).distinct()

        # regular employee: their own requests only
        return qs.filter(requested_by=user)

    def perform_create(self, serializer):
        user = self.request.user
        source_store = serializer.validated_data['source_store']
        # Auto-resolve destination store from requester's role
        user_store = get_user_store(user)
        dest = user_store if (user_store and user_store != source_store) else None

        req = serializer.save(
            requested_by=user,
            destination_store=dest,
            status=StoreRequest.Status.SUBMITTED,
        )
        # Notify storekeepers
        link = f'/inventory/requests/{req.id}'
        keepers = _storekeepers_for_store(source_store)
        from notifications.models import Notification
        _notify_sr(
            keepers,
            Notification.Type.SR_SUBMITTED,
            f'New Store Request {req.reference}',
            f'{user.get_full_name() or user.username} requested {req.quantity_requested} {req.item.unit} of {req.item.name}.',
            link,
        )


class StoreRequestDetailView(generics.RetrieveAPIView):
    serializer_class = StoreRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)
        qs = StoreRequest.objects.select_related(
            'item', 'source_store', 'destination_store',
            'requested_by', 'approved_by', 'dispatched_by', 'received_by',
        )
        if role in VIEW_ALL_ROLES:
            return qs
        from django.db.models import Q
        user_store = get_user_store(user)
        if user_store and _can_edit(user):
            return qs.filter(Q(source_store=user_store) | Q(requested_by=user))
        return qs.filter(requested_by=user)


def _get_request_or_403(pk, user):
    from rest_framework.exceptions import NotFound
    try:
        req = StoreRequest.objects.select_related(
            'item', 'source_store', 'destination_store', 'requested_by'
        ).get(pk=pk)
    except StoreRequest.DoesNotExist:
        raise NotFound()
    return req


class StoreRequestApproveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        req = _get_request_or_403(pk, request.user)
        if req.status != StoreRequest.Status.SUBMITTED:
            return Response({'detail': 'Request is not in submitted state.'}, status=400)
        user = request.user
        user_store = get_user_store(user)
        if not (_can_edit_anywhere(user) or (user_store and user_store == req.source_store)):
            raise PermissionDenied('You are not a storekeeper for this store.')
        serializer = StoreRequestApproveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        if d['quantity_approved'] > req.quantity_requested:
            return Response({'detail': 'Approved quantity cannot exceed requested quantity.'}, status=400)
        req.quantity_approved = d['quantity_approved']
        req.storekeeper_notes = d.get('storekeeper_notes', '')
        req.approved_by = user
        req.approved_at = timezone.now()
        req.status = StoreRequest.Status.APPROVED
        req.save()
        from notifications.models import Notification
        _notify_sr(
            [req.requested_by],
            Notification.Type.SR_APPROVED,
            f'Store Request {req.reference} Approved',
            f'Your request for {req.quantity_approved} {req.item.unit} of {req.item.name} has been approved.',
            f'/inventory/requests/{req.id}',
        )
        return Response(StoreRequestSerializer(req).data)


class StoreRequestRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        req = _get_request_or_403(pk, request.user)
        if req.status not in (StoreRequest.Status.SUBMITTED, StoreRequest.Status.APPROVED):
            return Response({'detail': 'Cannot reject at this stage.'}, status=400)
        user = request.user
        user_store = get_user_store(user)
        if not (_can_edit_anywhere(user) or (user_store and user_store == req.source_store)):
            raise PermissionDenied('You are not a storekeeper for this store.')
        serializer = StoreRequestRejectSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        req.rejection_reason = serializer.validated_data['rejection_reason']
        req.approved_by = user
        req.status = StoreRequest.Status.REJECTED
        req.save()
        from notifications.models import Notification
        _notify_sr(
            [req.requested_by],
            Notification.Type.SR_REJECTED,
            f'Store Request {req.reference} Rejected',
            f'Your request for {req.item.name} was rejected. Reason: {req.rejection_reason}',
            f'/inventory/requests/{req.id}',
        )
        return Response(StoreRequestSerializer(req).data)


class StoreRequestDispatchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        req = _get_request_or_403(pk, request.user)
        if req.status != StoreRequest.Status.APPROVED:
            return Response({'detail': 'Request must be approved before dispatching.'}, status=400)
        user = request.user
        user_store = get_user_store(user)
        if not (_can_edit_anywhere(user) or (user_store and user_store == req.source_store)):
            raise PermissionDenied('You are not a storekeeper for this store.')
        serializer = StoreRequestDispatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Deduct from source store via StockTransaction (which updates StockLevel automatically)
        from django.core.exceptions import ValidationError as DjangoValidationError
        ref = f'SR-OUT-{_uuid_mod.uuid4().hex[:8].upper()}'
        try:
            level = StockLevel.objects.get(item=req.item, store=req.source_store)
            unit_cost = float(level.weighted_avg_cost)
            StockTransaction.objects.create(
                transaction_type='issue',
                item=req.item,
                store=req.source_store,
                quantity=req.quantity_approved,
                unit_cost=unit_cost,
                reference_number=ref,
                processed_by=user,
                transaction_date=timezone.now(),
                issued_to=req.requested_by,
                notes=f'Dispatch for store request {req.reference}',
            )
        except (StockLevel.DoesNotExist, DjangoValidationError) as e:
            return Response({'detail': str(e)}, status=400)

        if serializer.validated_data.get('storekeeper_notes'):
            req.storekeeper_notes = serializer.validated_data['storekeeper_notes']
        req.dispatched_by = user
        req.dispatched_at = timezone.now()
        req.status = StoreRequest.Status.DISPATCHED
        req.save()
        from notifications.models import Notification
        _notify_sr(
            [req.requested_by],
            Notification.Type.SR_DISPATCHED,
            f'Items Dispatched — {req.reference}',
            f'{req.quantity_approved} {req.item.unit} of {req.item.name} have been dispatched to you. Please confirm receipt.',
            f'/inventory/requests/{req.id}',
        )
        return Response(StoreRequestSerializer(req).data)


class StoreRequestReceiveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        req = _get_request_or_403(pk, request.user)
        if req.status != StoreRequest.Status.DISPATCHED:
            return Response({'detail': 'No pending dispatch to confirm.'}, status=400)
        if req.requested_by != request.user and not _can_edit_anywhere(request.user):
            raise PermissionDenied('Only the requester can confirm receipt.')
        serializer = StoreRequestReceiveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        qty_recv = serializer.validated_data['quantity_received']

        # Credit destination store (if any) via StockTransaction
        if req.destination_store:
            try:
                src_level = StockLevel.objects.get(item=req.item, store=req.source_store)
                unit_cost = float(src_level.weighted_avg_cost)
            except StockLevel.DoesNotExist:
                unit_cost = 0
            ref = f'SR-IN-{_uuid_mod.uuid4().hex[:8].upper()}'
            StockTransaction.objects.create(
                transaction_type='grn',
                item=req.item,
                store=req.destination_store,
                quantity=qty_recv,
                unit_cost=unit_cost,
                reference_number=ref,
                processed_by=request.user,
                transaction_date=timezone.now(),
                notes=f'Receipt for store request {req.reference}',
            )

        req.quantity_received = qty_recv
        req.received_by = request.user
        req.received_at = timezone.now()
        req.status = StoreRequest.Status.RECEIVED
        req.save()
        from notifications.models import Notification
        keepers = _storekeepers_for_store(req.source_store)
        _notify_sr(
            keepers,
            Notification.Type.SR_RECEIVED,
            f'Store Request {req.reference} Received',
            f'{request.user.get_full_name() or request.user.username} confirmed receipt of {qty_recv} {req.item.unit} of {req.item.name}.',
            f'/inventory/requests/{req.id}',
        )
        return Response(StoreRequestSerializer(req).data)


class StoreRequestReturnView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        req = _get_request_or_403(pk, request.user)
        if req.status != StoreRequest.Status.DISPATCHED:
            return Response({'detail': 'Can only return dispatched items.'}, status=400)
        if req.requested_by != request.user and not _can_edit_anywhere(request.user):
            raise PermissionDenied('Only the requester can return items.')
        serializer = StoreRequestReturnSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Re-credit source store
        try:
            level = StockLevel.objects.get(item=req.item, store=req.source_store)
            unit_cost = float(level.weighted_avg_cost)
        except StockLevel.DoesNotExist:
            unit_cost = 0
        ref = f'SR-RET-{_uuid_mod.uuid4().hex[:8].upper()}'
        StockTransaction.objects.create(
            transaction_type='return',
            item=req.item,
            store=req.source_store,
            quantity=req.quantity_approved,
            unit_cost=unit_cost,
            reference_number=ref,
            processed_by=request.user,
            transaction_date=timezone.now(),
            notes=f'Return for store request {req.reference}: {serializer.validated_data["return_reason"]}',
        )
        req.return_reason = serializer.validated_data['return_reason']
        req.received_by = request.user
        req.received_at = timezone.now()
        req.status = StoreRequest.Status.RETURNED
        req.save()
        from notifications.models import Notification
        keepers = _storekeepers_for_store(req.source_store)
        _notify_sr(
            keepers,
            Notification.Type.SR_RETURNED,
            f'Store Request {req.reference} Returned',
            f'{request.user.get_full_name() or request.user.username} returned {req.quantity_approved} {req.item.unit} of {req.item.name}. Reason: {req.return_reason}',
            f'/inventory/requests/{req.id}',
        )
        return Response(StoreRequestSerializer(req).data)


class StoreRequestCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        req = _get_request_or_403(pk, request.user)
        if req.status in (StoreRequest.Status.DISPATCHED, StoreRequest.Status.RECEIVED,
                          StoreRequest.Status.RETURNED, StoreRequest.Status.CANCELLED):
            return Response({'detail': 'Cannot cancel at this stage.'}, status=400)
        if req.requested_by != request.user and not _can_edit_anywhere(request.user):
            raise PermissionDenied('Only the requester can cancel their request.')
        req.status = StoreRequest.Status.CANCELLED
        req.save()
        return Response(StoreRequestSerializer(req).data)
