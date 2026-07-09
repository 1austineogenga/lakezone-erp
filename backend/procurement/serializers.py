from datetime import date
from rest_framework import serializers
from .models import (
    Supplier, PurchaseRequisition, PRLineItem, PRApproval,
    PurchaseOrder, POLineItem, GoodsReceivedNote, GRNItem,
)


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = "__all__"
        read_only_fields = ["id", "performance_rating", "created_at", "updated_at"]


class PRLineItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PRLineItem
        fields = ["id", "description", "unit", "quantity", "estimated_unit_rate", "notes"]
        read_only_fields = ["id"]

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0.")
        return value

    def validate_estimated_unit_rate(self, value):
        if value < 0:
            raise serializers.ValidationError("Estimated unit rate must be >= 0.")
        return value


class PRApprovalSerializer(serializers.ModelSerializer):
    approved_by_name = serializers.CharField(source="approved_by.get_full_name", read_only=True)

    class Meta:
        model = PRApproval
        fields = ["id", "action", "stage", "comment", "approved_by_name", "timestamp"]


class PurchaseRequisitionSerializer(serializers.ModelSerializer):
    line_items = PRLineItemSerializer(many=True)
    approvals = PRApprovalSerializer(many=True, read_only=True)
    total_estimated_value = serializers.DecimalField(
        max_digits=18, decimal_places=2, read_only=True
    )
    requested_by_name = serializers.CharField(source="requested_by.get_full_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = PurchaseRequisition
        fields = [
            "id", "pr_number", "requested_by", "requested_by_name",
            "department", "project", "boq_item", "required_by_date",
            "status", "status_display", "rejection_reason",
            "line_items", "approvals", "total_estimated_value",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "pr_number", "created_at", "updated_at"]

    def validate_required_by_date(self, value):
        if value < date.today():
            raise serializers.ValidationError("required_by_date must be today or in the future.")
        return value

    def create(self, validated_data):
        line_items_data = validated_data.pop("line_items")
        pr = PurchaseRequisition.objects.create(**validated_data)
        for item_data in line_items_data:
            PRLineItem.objects.create(pr=pr, **item_data)
        return pr


class POLineItemSerializer(serializers.ModelSerializer):
    line_total = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)

    class Meta:
        model = POLineItem
        fields = ["id", "description", "unit", "quantity", "unit_price", "received_quantity", "line_total", "stock_item"]
        read_only_fields = ["id", "received_quantity"]

    def validate_quantity(self, value):
        if value <= 0:
            raise serializers.ValidationError("Quantity must be greater than 0.")
        return value

    def validate_unit_price(self, value):
        if value < 0:
            raise serializers.ValidationError("Unit price must be >= 0.")
        return value


class PurchaseOrderSerializer(serializers.ModelSerializer):
    line_items = POLineItemSerializer(many=True)
    total_value = serializers.DecimalField(max_digits=18, decimal_places=2, read_only=True)
    supplier_name = serializers.CharField(source="supplier.company_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            "id", "po_number", "pr", "supplier", "supplier_name", "project",
            "delivery_date", "delivery_address", "status", "status_display",
            "cancellation_reason", "notes", "line_items", "total_value",
            "created_by", "approved_by", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "po_number", "created_at", "updated_at"]

    def validate_delivery_date(self, value):
        # Only validate on create (when instance doesn't exist yet)
        if self.instance is None and value < date.today():
            raise serializers.ValidationError("delivery_date must be today or in the future.")
        return value

    def validate_supplier(self, value):
        from .models import SupplierStatus
        if value.status == SupplierStatus.BLACKLISTED:
            raise serializers.ValidationError(
                f"Supplier '{value.company_name}' is blacklisted and cannot be used in a Purchase Order."
            )
        return value

    def create(self, validated_data):
        line_items_data = validated_data.pop("line_items")
        po = PurchaseOrder.objects.create(**validated_data)
        for item_data in line_items_data:
            POLineItem.objects.create(po=po, **item_data)
        return po


class GRNItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = GRNItem
        fields = ["id", "po_line_item", "quantity_received", "unit_cost", "condition", "notes"]
        read_only_fields = ["id"]

    def validate_quantity_received(self, value):
        if value <= 0:
            raise serializers.ValidationError("quantity_received must be greater than 0.")
        return value

    def validate_unit_cost(self, value):
        if value < 0:
            raise serializers.ValidationError("unit_cost must be >= 0.")
        return value


class GoodsReceivedNoteSerializer(serializers.ModelSerializer):
    grn_items = GRNItemSerializer(many=True)
    received_by_name = serializers.CharField(source="received_by.get_full_name", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = GoodsReceivedNote
        fields = [
            "id", "grn_number", "purchase_order", "received_by", "received_by_name",
            "received_date", "notes", "status", "status_display",
            "grn_items", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "grn_number", "created_at", "updated_at"]

    def create(self, validated_data):
        grn_items_data = validated_data.pop("grn_items")
        grn = GoodsReceivedNote.objects.create(**validated_data)
        for item_data in grn_items_data:
            GRNItem.objects.create(grn=grn, **item_data)
        return grn


# ── Phase 6 serializers ───────────────────────────────────────────────────────
from .models import RFQ, RFQQuote, PODeliverySchedule


class RFQQuoteSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    is_overdue    = serializers.SerializerMethodField()

    class Meta:
        model  = RFQQuote
        fields = '__all__'
        read_only_fields = ('id', 'created_at')

    def get_is_overdue(self, obj):
        return False  # quotes don't expire in the same way


class RFQSerializer(serializers.ModelSerializer):
    quotes        = RFQQuoteSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    project_name  = serializers.CharField(source='project.name', read_only=True)
    awarded_to_name = serializers.CharField(source='awarded_to.company_name', read_only=True)
    is_overdue    = serializers.BooleanField(read_only=True)
    quote_count   = serializers.IntegerField(read_only=True)
    supplier_ids  = serializers.PrimaryKeyRelatedField(
        source='suppliers', many=True, queryset=__import__('procurement.models', fromlist=['Supplier']).Supplier.objects.all(),
        write_only=True, required=False
    )

    class Meta:
        model  = RFQ
        fields = '__all__'
        read_only_fields = ('id', 'rfq_number', 'created_by', 'created_at', 'updated_at')

    def create(self, validated_data):
        suppliers = validated_data.pop('suppliers', [])
        validated_data['created_by'] = self.context['request'].user
        rfq = RFQ.objects.create(**validated_data)
        if suppliers:
            rfq.suppliers.set(suppliers)
        return rfq

    def update(self, instance, validated_data):
        suppliers = validated_data.pop('suppliers', None)
        rfq = super().update(instance, validated_data)
        if suppliers is not None:
            rfq.suppliers.set(suppliers)
        return rfq


class PODeliveryScheduleSerializer(serializers.ModelSerializer):
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model  = PODeliverySchedule
        fields = '__all__'
        read_only_fields = ('id', 'created_at')
