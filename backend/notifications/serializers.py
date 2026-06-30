from rest_framework import serializers
from .models import Notification, ScheduledAction, ActionComment, ComplianceRenewalCase, ComplianceCaseStep


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ["id", "type", "title", "message", "link", "is_read", "created_at"]
        read_only_fields = ["id", "type", "title", "message", "link", "created_at"]


class ActionCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.get_full_name', read_only=True)

    class Meta:
        model  = ActionComment
        fields = '__all__'
        read_only_fields = ['author', 'created_at']


class ScheduledActionSerializer(serializers.ModelSerializer):
    created_by_name  = serializers.CharField(source='created_by.get_full_name', read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.get_full_name', read_only=True)
    comments         = ActionCommentSerializer(many=True, read_only=True)
    is_overdue       = serializers.SerializerMethodField()

    class Meta:
        model  = ScheduledAction
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_is_overdue(self, obj):
        from datetime import date
        return obj.status not in ('completed', 'cancelled') and obj.due_date < date.today()


class ComplianceCaseStepSerializer(serializers.ModelSerializer):
    actioned_by_name = serializers.CharField(source='actioned_by.get_full_name', read_only=True)
    step_label = serializers.SerializerMethodField()

    class Meta:
        model = ComplianceCaseStep
        fields = ['id', 'step', 'step_label', 'note', 'actioned_by', 'actioned_by_name', 'actioned_at']
        read_only_fields = ['id', 'actioned_by', 'actioned_at']

    def get_step_label(self, obj):
        return ComplianceRenewalCase.STEP_LABELS.get(obj.step, obj.step)


class ComplianceRenewalCaseSerializer(serializers.ModelSerializer):
    steps            = ComplianceCaseStepSerializer(many=True, read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.get_full_name', read_only=True)
    created_by_name  = serializers.CharField(source='created_by.get_full_name', read_only=True)
    step_index       = serializers.IntegerField(read_only=True)
    step_labels      = serializers.SerializerMethodField()
    contact_step_label = serializers.SerializerMethodField()
    bill_number      = serializers.CharField(source='bill.bill_number', read_only=True)
    bill_status      = serializers.CharField(source='bill.status', read_only=True)

    class Meta:
        model  = ComplianceRenewalCase
        fields = [
            'id', 'asset_name', 'asset_ref', 'compliance_type', 'original_expiry',
            'status', 'step_index', 'step_labels', 'contact_step_label',
            'assigned_to', 'assigned_to_name',
            'provider_name', 'provider_contact', 'contacted_date',
            'invoice_ref', 'invoice_amount', 'invoice_due_date',
            'bill', 'bill_number', 'bill_status',
            'new_expiry', 'new_cert_number',
            'created_by', 'created_by_name', 'created_at', 'updated_at', 'closed_at',
            'steps',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at', 'closed_at', 'bill']

    def get_step_labels(self, obj):
        return ComplianceRenewalCase.STEP_LABELS

    def get_contact_step_label(self, obj):
        return ComplianceRenewalCase.CONTACT_STEP_LABEL.get(obj.compliance_type, 'Provider Contacted')
