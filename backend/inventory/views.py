from rest_framework import generics
from core.permissions import IsStorekeeper
from .models import Store, StockItem, StockLevel, StockTransaction
from .serializers import (
    StoreSerializer,
    StockItemSerializer,
    StockLevelSerializer,
    StockTransactionSerializer,
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
