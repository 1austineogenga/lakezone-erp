from rest_framework import serializers
from .models import Supplier, PurchaseRequisition, PRLineItem, PRApproval, PurchaseOrder, POLineItem


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
        fields = ["id", "description", "unit", "quantity", "unit_price", "received_quantity", "line_total"]
        read_only_fields = ["id"]


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
            "notes", "line_items", "total_value",
            "created_by", "approved_by", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "po_number", "created_at", "updated_at"]

    def create(self, validated_data):
        line_items_data = validated_data.pop("line_items")
        po = PurchaseOrder.objects.create(**validated_data)
        for item_data in line_items_data:
            POLineItem.objects.create(po=po, **item_data)
        return po
