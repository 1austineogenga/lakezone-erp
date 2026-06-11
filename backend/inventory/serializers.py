from rest_framework import serializers
from .models import Store, StockItem, StockLevel, StockTransaction


class StoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = ["id", "name", "location", "storekeeper", "is_active"]
        read_only_fields = ["id"]


class StockItemSerializer(serializers.ModelSerializer):
    current_stock = serializers.SerializerMethodField()

    class Meta:
        model = StockItem
        fields = [
            "id", "item_code", "name", "category", "unit",
            "reorder_level", "valuation_method", "description",
            "is_active", "current_stock", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_current_stock(self, obj):
        return obj.current_stock()


class StockLevelSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_code = serializers.CharField(source="item.item_code", read_only=True)
    store_name = serializers.CharField(source="store.name", read_only=True)
    is_below_reorder = serializers.SerializerMethodField()

    class Meta:
        model = StockLevel
        fields = [
            "id", "item", "item_code", "item_name", "store", "store_name",
            "quantity_on_hand", "weighted_avg_cost", "is_below_reorder", "last_updated",
        ]

    def get_is_below_reorder(self, obj):
        return obj.quantity_on_hand <= obj.item.reorder_level


class StockTransactionSerializer(serializers.ModelSerializer):
    processed_by_name = serializers.CharField(source="processed_by.get_full_name", read_only=True)
    transaction_type_display = serializers.CharField(source="get_transaction_type_display", read_only=True)
    line_total = serializers.SerializerMethodField()

    class Meta:
        model = StockTransaction
        fields = [
            "id", "transaction_type", "transaction_type_display",
            "item", "store", "destination_store",
            "quantity", "unit_cost", "line_total",
            "project", "boq_item", "po",
            "reference_number", "processed_by", "processed_by_name",
            "transaction_date", "notes", "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def get_line_total(self, obj):
        return obj.quantity * obj.unit_cost

    def create(self, validated_data):
        validated_data["processed_by"] = self.context["request"].user
        return super().create(validated_data)
