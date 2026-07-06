from rest_framework import serializers
from .models import Store, StockItem, StockLevel, StockTransaction, Asset, AssetMaintenanceLog, StoreRequest


class StoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = ["id", "name", "location", "storekeeper", "is_active"]
        extra_kwargs = {
            "storekeeper": {"required": False, "allow_null": True},
            "location":    {"required": False, "allow_blank": True},
        }
        read_only_fields = ["id"]


class StockItemSerializer(serializers.ModelSerializer):
    current_stock     = serializers.SerializerMethodField()
    weighted_avg_cost = serializers.SerializerMethodField()
    department_name   = serializers.CharField(source='department.name', read_only=True)

    class Meta:
        model = StockItem
        fields = [
            "id", "item_code", "name", "category", "unit",
            "reorder_level", "valuation_method", "description",
            "is_active", "department", "department_name",
            "site_location",
            "current_stock", "weighted_avg_cost", "created_at",
        ]
        read_only_fields = ["id", "item_code", "created_at"]

    def get_current_stock(self, obj):
        return obj.current_stock()

    def get_weighted_avg_cost(self, obj):
        """Return the aggregate weighted average cost across all stores."""
        levels = obj.stock_levels.all()
        total_qty = sum(float(sl.quantity_on_hand) for sl in levels)
        if total_qty <= 0:
            return 0
        total_value = sum(
            float(sl.quantity_on_hand) * float(sl.weighted_avg_cost) for sl in levels
        )
        return round(total_value / total_qty, 2)


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
    item_name = serializers.CharField(source="item.name", read_only=True)
    item_code = serializers.CharField(source="item.item_code", read_only=True)
    store_name = serializers.CharField(source="store.name", read_only=True)
    line_total = serializers.SerializerMethodField()
    issued_to_display = serializers.SerializerMethodField()

    class Meta:
        model = StockTransaction
        fields = [
            "id", "transaction_type", "transaction_type_display",
            "item", "item_name", "item_code", "store", "store_name", "destination_store",
            "quantity", "unit_cost", "line_total",
            "project", "boq_item", "po",
            "reference_number", "processed_by", "processed_by_name",
            "transaction_date", "notes",
            "issued_to", "issued_to_name", "issued_to_display",
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "processed_by_name",
                            "transaction_type_display", "item_name", "item_code",
                            "store_name", "line_total", "issued_to_display"]
        extra_kwargs = {
            "reference_number": {"required": False, "allow_blank": True},
            "processed_by":     {"required": False, "allow_null": True},
        }

    def get_line_total(self, obj):
        return obj.quantity * obj.unit_cost

    def get_issued_to_display(self, obj):
        if obj.issued_to:
            return obj.issued_to.get_full_name() or obj.issued_to.username
        return obj.issued_to_name or ''

    def create(self, validated_data):
        validated_data["processed_by"] = self.context["request"].user
        return super().create(validated_data)


class AssetMaintenanceLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AssetMaintenanceLog
        fields = [
            'id', 'asset', 'date', 'description', 'cost',
            'performed_by', 'next_service_date', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'asset']


class AssetSerializer(serializers.ModelSerializer):
    maintenance_count = serializers.SerializerMethodField()
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    condition_display = serializers.CharField(source='get_condition_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Asset
        fields = [
            'id', 'asset_code', 'name', 'category', 'category_display',
            'department', 'serial_number', 'make_model',
            'purchase_date', 'purchase_value', 'current_value',
            'condition', 'condition_display', 'status', 'status_display',
            'location', 'assigned_to', 'notes',
            # machinery
            'hours_to_next_service',
            # vehicles & trucks
            'registration_plate', 'kms_to_next_service',
            # insurance certificate
            'insurance_expiry', 'insurance_cert_number', 'insurance_policy_number',
            'insurance_policy_type', 'insurance_insurer', 'insurance_chassis_number',
            'insurance_commencement_date',
            # inspection certificate (trucks & tracks)
            'inspection_cert_number', 'inspection_cert_status',
            'inspection_cert_issue_date', 'inspection_cert_expiry',
            'inspection_issuing_authority',
            # speed governor certificate (trucks & tracks)
            'speed_governor_cert_number', 'speed_governor_cert_status',
            'speed_governor_device_serial', 'speed_governor_cert_issue_date',
            'speed_governor_cert_expiry', 'speed_governor_issuing_authority',
            # defects & requirements
            'current_defects', 'requirements',
            'maintenance_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'asset_code', 'created_at', 'updated_at',
                            'inspection_cert_status', 'speed_governor_cert_status']

    def get_maintenance_count(self, obj):
        return obj.maintenance_logs.count()


# ── Store Item Browse (for request form — any user, read-only) ────────────────

class StoreItemBrowseSerializer(serializers.ModelSerializer):
    stock_in_store = serializers.SerializerMethodField()

    class Meta:
        model = StockItem
        fields = ['id', 'item_code', 'name', 'category', 'unit', 'reorder_level',
                  'weighted_avg_cost', 'stock_in_store']

    def get_stock_in_store(self, obj):
        store_pk = self.context.get('store_pk')
        for sl in obj.stock_levels.all():
            if str(sl.store_id) == str(store_pk):
                return float(sl.quantity_on_hand)
        return 0

    def get_weighted_avg_cost(self, obj):
        store_pk = self.context.get('store_pk')
        for sl in obj.stock_levels.all():
            if str(sl.store_id) == str(store_pk):
                return float(sl.weighted_avg_cost)
        return 0

    # declare the field as SerializerMethodField too
    weighted_avg_cost = serializers.SerializerMethodField()


# ── Store Request serializers ─────────────────────────────────────────────────

class StoreRequestSerializer(serializers.ModelSerializer):
    requested_by_name   = serializers.CharField(source='requested_by.get_full_name',  read_only=True)
    requested_by_role   = serializers.CharField(source='requested_by.role',            read_only=True)
    approved_by_name    = serializers.CharField(source='approved_by.get_full_name',    read_only=True)
    dispatched_by_name  = serializers.CharField(source='dispatched_by.get_full_name',  read_only=True)
    received_by_name    = serializers.CharField(source='received_by.get_full_name',    read_only=True)
    source_store_name   = serializers.CharField(source='source_store.name',            read_only=True)
    destination_store_name = serializers.CharField(source='destination_store.name',    read_only=True)
    item_name           = serializers.CharField(source='item.name',                    read_only=True)
    item_code           = serializers.CharField(source='item.item_code',               read_only=True)
    item_unit           = serializers.CharField(source='item.unit',                    read_only=True)

    class Meta:
        model  = StoreRequest
        fields = [
            'id', 'reference', 'status',
            'item', 'item_name', 'item_code', 'item_unit',
            'quantity_requested', 'quantity_approved', 'quantity_received',
            'source_store', 'source_store_name',
            'destination_store', 'destination_store_name',
            'requested_by', 'requested_by_name', 'requested_by_role',
            'approved_by', 'approved_by_name',
            'dispatched_by', 'dispatched_by_name',
            'received_by', 'received_by_name',
            'justification', 'date_required',
            'storekeeper_notes', 'rejection_reason', 'return_reason',
            'requested_at', 'approved_at', 'dispatched_at', 'received_at',
        ]
        read_only_fields = fields


class StoreRequestListSerializer(serializers.ModelSerializer):
    requested_by_name = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    source_store_name = serializers.CharField(source='source_store.name',           read_only=True)
    item_name         = serializers.CharField(source='item.name',                   read_only=True)
    item_unit         = serializers.CharField(source='item.unit',                   read_only=True)

    class Meta:
        model  = StoreRequest
        fields = [
            'id', 'reference', 'status',
            'item', 'item_name', 'item_unit',
            'quantity_requested', 'quantity_approved', 'quantity_received',
            'source_store', 'source_store_name',
            'requested_by_name', 'justification', 'date_required',
            'requested_at', 'approved_at', 'dispatched_at', 'received_at',
        ]


class StoreRequestCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = StoreRequest
        fields = ['item', 'quantity_requested', 'source_store', 'justification', 'date_required']

    def validate_quantity_requested(self, v):
        if v <= 0:
            raise serializers.ValidationError('Quantity must be greater than 0.')
        return v


class StoreRequestApproveSerializer(serializers.Serializer):
    quantity_approved  = serializers.DecimalField(max_digits=14, decimal_places=4)
    storekeeper_notes  = serializers.CharField(required=False, allow_blank=True)

    def validate_quantity_approved(self, v):
        if v <= 0:
            raise serializers.ValidationError('Approved quantity must be greater than 0.')
        return v


class StoreRequestRejectSerializer(serializers.Serializer):
    rejection_reason = serializers.CharField()


class StoreRequestDispatchSerializer(serializers.Serializer):
    storekeeper_notes = serializers.CharField(required=False, allow_blank=True)


class StoreRequestReceiveSerializer(serializers.Serializer):
    quantity_received = serializers.DecimalField(max_digits=14, decimal_places=4)

    def validate_quantity_received(self, v):
        if v <= 0:
            raise serializers.ValidationError('Received quantity must be greater than 0.')
        return v


class StoreRequestReturnSerializer(serializers.Serializer):
    return_reason = serializers.CharField()
