from rest_framework import serializers
from .models import QualityInspection, NCR, MaterialTest, PunchListItem


class QualityInspectionSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = QualityInspection
        fields = '__all__'
        read_only_fields = ['id', 'recorded_by', 'created_at', 'updated_at']

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return obj.recorded_by.get_full_name() or obj.recorded_by.email
        return None

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['recorded_by'] = request.user
        return super().create(validated_data)


class NCRSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = NCR
        fields = '__all__'
        read_only_fields = ['id', 'recorded_by', 'created_at', 'updated_at']

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return obj.recorded_by.get_full_name() or obj.recorded_by.email
        return None

    def get_is_overdue(self, obj):
        return obj.is_overdue

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['recorded_by'] = request.user
        return super().create(validated_data)


class MaterialTestSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = MaterialTest
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


class PunchListItemSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()

    class Meta:
        model = PunchListItem
        fields = '__all__'
        read_only_fields = ['id', 'recorded_by', 'created_at', 'updated_at']

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return obj.recorded_by.get_full_name() or obj.recorded_by.email
        return None

    def get_is_overdue(self, obj):
        return obj.is_overdue

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            validated_data['recorded_by'] = request.user
        return super().create(validated_data)
