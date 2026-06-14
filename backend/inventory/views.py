from django.db.models import Sum, Count
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from core.permissions import IsStorekeeper
from .models import Store, StockItem, StockLevel, StockTransaction, Asset, AssetMaintenanceLog
from .serializers import (
    StoreSerializer,
    StockItemSerializer,
    StockLevelSerializer,
    StockTransactionSerializer,
    AssetSerializer,
    AssetMaintenanceLogSerializer,
)


class StoreListCreateView(generics.ListCreateAPIView):
    queryset = Store.objects.filter(is_active=True)
    serializer_class = StoreSerializer
    permission_classes = [IsStorekeeper]


class StockItemListCreateView(generics.ListCreateAPIView):
    queryset = StockItem.objects.filter(is_active=True).prefetch_related("stock_levels")
    serializer_class = StockItemSerializer
    permission_classes = [IsStorekeeper]
    filterset_fields = ["category", "valuation_method"]
    search_fields = ["item_code", "name"]


class StockItemDetailView(generics.RetrieveUpdateAPIView):
    queryset = StockItem.objects.all().prefetch_related("stock_levels")
    serializer_class = StockItemSerializer
    permission_classes = [IsStorekeeper]


class StockLevelListView(generics.ListAPIView):
    queryset = StockLevel.objects.select_related("item", "store").all()
    serializer_class = StockLevelSerializer
    filterset_fields = ["store", "item"]


class LowStockItemsView(generics.ListAPIView):
    """Returns stock items where current stock across all stores is at or below reorder level."""
    serializer_class = StockItemSerializer

    def get_queryset(self):
        from django.db.models import Sum
        from django.db.models import OuterRef, Subquery
        items = StockItem.objects.filter(is_active=True).prefetch_related("stock_levels")
        low = []
        for item in items:
            current = item.current_stock()
            if float(current) <= float(item.reorder_level):
                low.append(item.pk)
        return StockItem.objects.filter(pk__in=low).prefetch_related("stock_levels")


class StockTransactionListCreateView(generics.ListCreateAPIView):
    queryset = StockTransaction.objects.select_related(
        "item", "store", "project", "processed_by"
    )
    serializer_class = StockTransactionSerializer
    permission_classes = [IsStorekeeper]
    filterset_fields = ["transaction_type", "store", "project", "item"]
    search_fields = ["reference_number"]
    ordering_fields = ["transaction_date"]


class StockTransactionDetailView(generics.RetrieveAPIView):
    queryset = StockTransaction.objects.all()
    serializer_class = StockTransactionSerializer


# ---------------------------------------------------------------------------
# Fixed Assets Register Views
# ---------------------------------------------------------------------------

class AssetListCreateView(generics.ListCreateAPIView):
    serializer_class = AssetSerializer
    filterset_fields = ['department', 'category', 'status', 'condition']
    search_fields = ['name', 'asset_code', 'serial_number', 'assigned_to']

    def get_queryset(self):
        return Asset.objects.prefetch_related('maintenance_logs').all()


class AssetDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Asset.objects.prefetch_related('maintenance_logs').all()
    serializer_class = AssetSerializer


class AssetMaintenanceListCreateView(generics.ListCreateAPIView):
    serializer_class = AssetMaintenanceLogSerializer

    def get_queryset(self):
        return AssetMaintenanceLog.objects.filter(asset_id=self.kwargs['asset_pk'])

    def perform_create(self, serializer):
        asset = Asset.objects.get(pk=self.kwargs['asset_pk'])
        serializer.save(asset=asset)


class AssetDashboardView(APIView):
    def get(self, request):
        qs = Asset.objects.all()
        total_assets = qs.count()
        total_purchase_value = qs.aggregate(v=Sum('purchase_value'))['v'] or 0
        total_current_value = qs.aggregate(v=Sum('current_value'))['v'] or 0
        active_count = qs.filter(status='active').count()
        under_repair_count = qs.filter(status='under_repair').count()
        disposed_count = qs.filter(status='disposed').count()
        lost_count = qs.filter(status='lost').count()

        by_department = list(
            qs.values('department').annotate(count=Count('id'), value=Sum('current_value')).order_by('department')
        )
        by_category = list(
            qs.values('category').annotate(count=Count('id'), value=Sum('current_value')).order_by('category')
        )
        by_condition = list(
            qs.values('condition').annotate(count=Count('id')).order_by('condition')
        )

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
