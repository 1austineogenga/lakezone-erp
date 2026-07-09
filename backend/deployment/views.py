from rest_framework import generics, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from .models import LabourDeployment, EquipmentDeployment
from .serializers import LabourDeploymentSerializer, EquipmentDeploymentSerializer


class LabourDeploymentListCreate(generics.ListCreateAPIView):
    serializer_class = LabourDeploymentSerializer
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project_id', 'date', 'role', 'status', 'shift']
    search_fields    = ['employee__first_name', 'employee__last_name', 'project_name', 'activity']
    ordering_fields  = ['date', 'created_at']

    def get_queryset(self):
        qs = LabourDeployment.objects.select_related('employee', 'employee__position', 'recorded_by')
        date_from = self.request.query_params.get('date_from')
        date_to   = self.request.query_params.get('date_to')
        if date_from: qs = qs.filter(date__gte=date_from)
        if date_to:   qs = qs.filter(date__lte=date_to)
        return qs

    def get_serializer_context(self):
        return {'request': self.request}


class LabourDeploymentDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = LabourDeployment.objects.select_related('employee', 'recorded_by').all()
    serializer_class = LabourDeploymentSerializer

    def get_serializer_context(self):
        return {'request': self.request}


class EquipmentDeploymentListCreate(generics.ListCreateAPIView):
    serializer_class = EquipmentDeploymentSerializer
    filter_backends  = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project_id', 'date', 'equipment_type', 'status', 'shift']
    search_fields    = ['vehicle__vehicle_no', 'vehicle__vehicle_name', 'project_name', 'activity', 'equipment_id_ref']
    ordering_fields  = ['date', 'created_at']

    def get_queryset(self):
        qs = EquipmentDeployment.objects.select_related('vehicle', 'recorded_by')
        date_from = self.request.query_params.get('date_from')
        date_to   = self.request.query_params.get('date_to')
        if date_from: qs = qs.filter(date__gte=date_from)
        if date_to:   qs = qs.filter(date__lte=date_to)
        return qs

    def get_serializer_context(self):
        return {'request': self.request}


class EquipmentDeploymentDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = EquipmentDeployment.objects.select_related('vehicle', 'recorded_by').all()
    serializer_class = EquipmentDeploymentSerializer

    def get_serializer_context(self):
        return {'request': self.request}


class DeploymentDashboardView(APIView):
    def get(self, request):
        today      = timezone.now().date()
        proj       = request.query_params.get('project_id')
        labour     = LabourDeployment.objects.all()
        equipment  = EquipmentDeployment.objects.all()
        if proj:
            labour    = labour.filter(project_id=proj)
            equipment = equipment.filter(project_id=proj)

        labour_today    = labour.filter(date=today)
        equipment_today = equipment.filter(date=today)

        # By project (today)
        proj_labour = {}
        for d in labour_today.values('project_name'):
            p = d['project_name']
            proj_labour[p] = proj_labour.get(p, 0) + 1

        # By role (today)
        by_role = {}
        for d in labour_today.values('role'):
            r = d['role']
            by_role[r] = by_role.get(r, 0) + 1

        # By equipment type (today)
        by_equip = {}
        for d in equipment_today.values('equipment_type'):
            t = d['equipment_type']
            by_equip[t] = by_equip.get(t, 0) + 1

        # Breakdowns
        breakdowns = equipment.filter(status='breakdown', date=today).count()

        return Response({
            'labour_today':       labour_today.count(),
            'equipment_today':    equipment_today.count(),
            'breakdowns_today':   breakdowns,
            'total_labour_records': labour.count(),
            'total_equipment_records': equipment.count(),
            'by_project':         proj_labour,
            'by_role':            by_role,
            'by_equipment_type':  by_equip,
            'recent_labour':      LabourDeploymentSerializer(
                labour.order_by('-created_at')[:8], many=True, context={'request': request}).data,
            'recent_equipment':   EquipmentDeploymentSerializer(
                equipment.order_by('-created_at')[:8], many=True, context={'request': request}).data,
        })
