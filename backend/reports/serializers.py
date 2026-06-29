from rest_framework import serializers
from .models import (
    ForemanDailyReport, ForemanWeeklyReport,
    SurveyorDailyReport, SurveyorWeeklyReport,
    MachineDailyReport, MachineWeeklyReport,
)


class BaseReportSerializer(serializers.ModelSerializer):
    is_editable = serializers.SerializerMethodField()
    submitted_by_name = serializers.SerializerMethodField()

    def get_is_editable(self, obj):
        return obj.is_editable

    def get_submitted_by_name(self, obj):
        if obj.submitted_by:
            return obj.submitted_by.get_full_name() or obj.submitted_by.username
        return ''

    def create(self, validated_data):
        validated_data['submitted_by'] = self.context['request'].user
        return super().create(validated_data)


class ForemanDailyReportSerializer(BaseReportSerializer):
    class Meta:
        model = ForemanDailyReport
        fields = '__all__'
        read_only_fields = ('id', 'submitted_by', 'submitted_at', 'updated_at')


class ForemanWeeklyReportSerializer(BaseReportSerializer):
    class Meta:
        model = ForemanWeeklyReport
        fields = '__all__'
        read_only_fields = ('id', 'submitted_by', 'submitted_at', 'updated_at')


class SurveyorDailyReportSerializer(BaseReportSerializer):
    class Meta:
        model = SurveyorDailyReport
        fields = '__all__'
        read_only_fields = ('id', 'submitted_by', 'submitted_at', 'updated_at')


class SurveyorWeeklyReportSerializer(BaseReportSerializer):
    class Meta:
        model = SurveyorWeeklyReport
        fields = '__all__'
        read_only_fields = ('id', 'submitted_by', 'submitted_at', 'updated_at')


class MachineDailyReportSerializer(BaseReportSerializer):
    class Meta:
        model = MachineDailyReport
        fields = '__all__'
        read_only_fields = ('id', 'submitted_by', 'submitted_at', 'updated_at')


class MachineWeeklyReportSerializer(BaseReportSerializer):
    class Meta:
        model = MachineWeeklyReport
        fields = '__all__'
        read_only_fields = ('id', 'submitted_by', 'submitted_at', 'updated_at')
