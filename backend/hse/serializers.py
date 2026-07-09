from rest_framework import serializers
from .models import HSEIncident, ToolboxTalk, SiteInduction, PPEIssuance


class HSEIncidentSerializer(serializers.ModelSerializer):
    reported_by_name = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = HSEIncident
        fields = '__all__'
        read_only_fields = ['id', 'reported_by', 'created_at', 'updated_at']

    def get_reported_by_name(self, obj):
        if obj.reported_by:
            return obj.reported_by.get_full_name() or obj.reported_by.email
        return None

    def get_is_overdue(self, obj):
        return obj.is_overdue

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['reported_by'] = request.user
        return super().create(validated_data)


class ToolboxTalkSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = ToolboxTalk
        fields = '__all__'
        read_only_fields = ['id', 'recorded_by', 'created_at']

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return obj.recorded_by.get_full_name() or obj.recorded_by.email
        return None

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['recorded_by'] = request.user
        return super().create(validated_data)


class SiteInductionSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()
    is_expired = serializers.SerializerMethodField()

    class Meta:
        model = SiteInduction
        fields = '__all__'
        read_only_fields = ['id', 'recorded_by', 'created_at']

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return obj.recorded_by.get_full_name() or obj.recorded_by.email
        return None

    def get_is_expired(self, obj):
        return obj.is_expired

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['recorded_by'] = request.user
        return super().create(validated_data)


class PPEIssuanceSerializer(serializers.ModelSerializer):
    issued_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PPEIssuance
        fields = '__all__'
        read_only_fields = ['id', 'issued_by', 'created_at']

    def get_issued_by_name(self, obj):
        if obj.issued_by:
            return obj.issued_by.get_full_name() or obj.issued_by.email
        return None

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['issued_by'] = request.user
        return super().create(validated_data)
