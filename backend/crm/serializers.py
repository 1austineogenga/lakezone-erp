from rest_framework import serializers
from django.utils import timezone
from .models import Client, TenderOpportunity, ClientInteraction


class ClientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        fields = "__all__"
        read_only_fields = ["id", "created_at"]


class TenderOpportunitySerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source="client.company_name", read_only=True)
    assigned_to_name = serializers.CharField(source="assigned_to.get_full_name", read_only=True)
    stage_display = serializers.CharField(source="get_stage_display", read_only=True)

    class Meta:
        model = TenderOpportunity
        fields = [
            "id", "opportunity_name", "client", "client_name",
            "tender_number", "estimated_value", "stage", "stage_display",
            "submission_deadline", "assigned_to", "assigned_to_name",
            "probability_percent", "win_loss_reason", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_probability_percent(self, value):
        if value is not None and not (0 <= value <= 100):
            raise serializers.ValidationError("Probability must be between 0 and 100.")
        return value

    def validate_estimated_value(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("Estimated value must be >= 0.")
        return value

    def validate_submission_deadline(self, value):
        # Only enforce future deadline on create (not on updates)
        if value is not None and self.instance is None:
            if value <= timezone.now():
                raise serializers.ValidationError("Tender submission deadline must be in the future.")
        return value


class ClientInteractionSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.get_full_name", read_only=True)

    class Meta:
        model = ClientInteraction
        fields = ["id", "client", "interaction_type", "date", "notes", "created_by", "created_by_name", "created_at"]
        read_only_fields = ["id", "created_by", "created_at", "client"]
