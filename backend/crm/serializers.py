from rest_framework import serializers
from .models import Client, TenderOpportunity


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
