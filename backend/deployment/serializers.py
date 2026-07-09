from rest_framework import serializers
from .models import LabourDeployment, EquipmentDeployment


class LabourDeploymentSerializer(serializers.ModelSerializer):
    employee_name   = serializers.CharField(source='employee.full_name', read_only=True)
    employee_number = serializers.CharField(source='employee.employee_number', read_only=True)
    employee_position = serializers.CharField(source='employee.position.title', read_only=True, default='')
    recorded_by_name = serializers.CharField(source='recorded_by.get_full_name', read_only=True)

    class Meta:
        model  = LabourDeployment
        fields = '__all__'
        read_only_fields = ('id', 'recorded_by', 'created_at')

    def create(self, validated_data):
        validated_data['recorded_by'] = self.context['request'].user
        return super().create(validated_data)


class EquipmentDeploymentSerializer(serializers.ModelSerializer):
    vehicle_no      = serializers.CharField(source='vehicle.vehicle_no', read_only=True, default='')
    vehicle_name    = serializers.CharField(source='vehicle.vehicle_name', read_only=True, default='')
    recorded_by_name = serializers.CharField(source='recorded_by.get_full_name', read_only=True)

    class Meta:
        model  = EquipmentDeployment
        fields = '__all__'
        read_only_fields = ('id', 'recorded_by', 'created_at')

    def create(self, validated_data):
        validated_data['recorded_by'] = self.context['request'].user
        return super().create(validated_data)
