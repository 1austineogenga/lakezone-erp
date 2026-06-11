from rest_framework import serializers
from .models import Project, Tender, BOQItem, ProjectDocument


class BOQItemSerializer(serializers.ModelSerializer):
    budget_variance = serializers.DecimalField(
        max_digits=18, decimal_places=2, read_only=True
    )
    cost_performance_index = serializers.FloatField(read_only=True)

    class Meta:
        model = BOQItem
        fields = [
            "id", "tender", "item_code", "description", "unit",
            "quantity", "unit_rate", "total_cost", "actual_cost",
            "progress_percent", "boq_version", "parent_boq_item",
            "budget_variance", "cost_performance_index",
            "created_at", "updated_at",
        ]
        read_only_fields = ["id", "total_cost", "created_at", "updated_at"]


class TenderSerializer(serializers.ModelSerializer):
    boq_items = BOQItemSerializer(many=True, read_only=True)
    boq_item_count = serializers.IntegerField(source="boq_items.count", read_only=True)
    tender_status_display = serializers.CharField(source="get_tender_status_display", read_only=True)

    class Meta:
        model = Tender
        fields = [
            "id", "project", "tender_number", "tender_description",
            "tender_value", "tender_status", "tender_status_display",
            "submission_date", "award_date", "boq_items", "boq_item_count",
            "created_by", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class TenderListSerializer(serializers.ModelSerializer):
    tender_status_display = serializers.CharField(source="get_tender_status_display", read_only=True)
    boq_item_count = serializers.IntegerField(source="boq_items.count", read_only=True)

    class Meta:
        model = Tender
        fields = [
            "id", "tender_number", "tender_description", "tender_value",
            "tender_status", "tender_status_display", "submission_date",
            "award_date", "boq_item_count", "created_at",
        ]


class ProjectSerializer(serializers.ModelSerializer):
    project_manager_name = serializers.CharField(
        source="project_manager.get_full_name", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    tenders = TenderListSerializer(many=True, read_only=True)
    total_boq_budget = serializers.DecimalField(
        max_digits=18, decimal_places=2, read_only=True
    )
    total_actual_cost = serializers.DecimalField(
        max_digits=18, decimal_places=2, read_only=True
    )

    class Meta:
        model = Project
        fields = [
            "id", "project_name", "client_name", "contract_number",
            "project_manager", "project_manager_name",
            "start_date", "end_date", "contract_sum",
            "project_location", "status", "status_display", "description",
            "tenders", "total_boq_budget", "total_actual_cost",
            "created_by", "created_at", "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class ProjectListSerializer(serializers.ModelSerializer):
    project_manager_name = serializers.CharField(
        source="project_manager.get_full_name", read_only=True
    )
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    tender_count = serializers.IntegerField(source="tenders.count", read_only=True)

    class Meta:
        model = Project
        fields = [
            "id", "project_name", "contract_number", "project_manager_name",
            "start_date", "end_date", "contract_sum", "status", "status_display",
            "project_location", "tender_count", "created_at",
        ]


class ProjectDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source="uploaded_by.get_full_name", read_only=True)

    class Meta:
        model = ProjectDocument
        fields = ["id", "project", "title", "file", "uploaded_by", "uploaded_by_name", "uploaded_at"]
        read_only_fields = ["id", "uploaded_at"]

    def create(self, validated_data):
        validated_data["uploaded_by"] = self.context["request"].user
        return super().create(validated_data)


class BOQUploadSerializer(serializers.Serializer):
    file = serializers.FileField()
    file_format = serializers.ChoiceField(choices=["xlsx", "csv"])
