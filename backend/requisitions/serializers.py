from rest_framework import serializers
from .models import StaffRequisition, RequisitionItem, RequisitionApproval


class RequisitionItemSerializer(serializers.ModelSerializer):
    class Meta:
        model  = RequisitionItem
        fields = ['id', 'description', 'quantity', 'unit', 'unit_price', 'total_price', 'stock_item', 'notes']


class RequisitionApprovalSerializer(serializers.ModelSerializer):
    approved_by_name = serializers.CharField(source='approved_by.get_full_name', read_only=True)

    class Meta:
        model  = RequisitionApproval
        fields = ['id', 'stage', 'action', 'approved_by', 'approved_by_name', 'comments', 'actioned_at']


class StaffRequisitionSerializer(serializers.ModelSerializer):
    items              = RequisitionItemSerializer(many=True, read_only=True)
    approvals          = RequisitionApprovalSerializer(many=True, read_only=True)
    requested_by_name  = serializers.CharField(source='requested_by.get_full_name', read_only=True)
    department_name    = serializers.CharField(source='department.name', read_only=True)
    project_name       = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model  = StaffRequisition
        fields = [
            'id', 'reference_number', 'title', 'req_type', 'status', 'priority',
            'requested_by', 'requested_by_name', 'department', 'department_name',
            'project', 'project_name', 'description', 'date_required', 'total_amount',
            'created_at', 'updated_at', 'fulfilled_at', 'fulfillment_notes',
            'items', 'approvals',
        ]
        read_only_fields = ['reference_number', 'requested_by', 'total_amount', 'status']


class StaffRequisitionCreateSerializer(serializers.ModelSerializer):
    items = RequisitionItemSerializer(many=True)

    class Meta:
        model  = StaffRequisition
        fields = ['title', 'req_type', 'priority', 'department', 'project',
                  'description', 'date_required', 'items']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        req = StaffRequisition.objects.create(
            **validated_data,
            requested_by=self.context['request'].user,
            status=StaffRequisition.Status.SUBMITTED,
        )
        for item in items_data:
            RequisitionItem.objects.create(requisition=req, **item)
        req.recalculate_total()
        return req


class ApprovalActionSerializer(serializers.Serializer):
    action   = serializers.ChoiceField(choices=RequisitionApproval.Action.choices)
    comments = serializers.CharField(required=False, allow_blank=True)
