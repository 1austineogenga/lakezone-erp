from rest_framework import generics, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count
from django.utils import timezone

from .models import HSEIncident, ToolboxTalk, SiteInduction, PPEIssuance
from .serializers import (
    HSEIncidentSerializer, ToolboxTalkSerializer,
    SiteInductionSerializer, PPEIssuanceSerializer,
)


class HSEIncidentListCreate(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = HSEIncidentSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['location', 'description', 'project_name', 'persons_involved']
    ordering = ['-date', '-created_at']

    def get_queryset(self):
        qs = HSEIncident.objects.all()
        if pid := self.request.query_params.get('project_id'):
            qs = qs.filter(project_id=pid)
        if v := self.request.query_params.get('status'):
            qs = qs.filter(status=v)
        if v := self.request.query_params.get('severity'):
            qs = qs.filter(severity=v)
        if v := self.request.query_params.get('incident_type'):
            qs = qs.filter(incident_type=v)
        return qs


class HSEIncidentDetail(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = HSEIncidentSerializer
    queryset = HSEIncident.objects.all()


class ToolboxTalkListCreate(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ToolboxTalkSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['topic', 'conducted_by', 'project_name', 'location']
    ordering = ['-date', '-created_at']

    def get_queryset(self):
        qs = ToolboxTalk.objects.all()
        if pid := self.request.query_params.get('project_id'):
            qs = qs.filter(project_id=pid)
        return qs


class ToolboxTalkDetail(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ToolboxTalkSerializer
    queryset = ToolboxTalk.objects.all()


class SiteInductionListCreate(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SiteInductionSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['person_name', 'company', 'role', 'project_name']
    ordering = ['-induction_date', '-created_at']

    def get_queryset(self):
        qs = SiteInduction.objects.all()
        if pid := self.request.query_params.get('project_id'):
            qs = qs.filter(project_id=pid)
        return qs


class SiteInductionDetail(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = SiteInductionSerializer
    queryset = SiteInduction.objects.all()


class PPEIssuanceListCreate(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PPEIssuanceSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['person_name', 'employee_id', 'project_name']
    ordering = ['-issue_date', '-created_at']

    def get_queryset(self):
        qs = PPEIssuance.objects.all()
        if pid := self.request.query_params.get('project_id'):
            qs = qs.filter(project_id=pid)
        if v := self.request.query_params.get('ppe_item'):
            qs = qs.filter(ppe_item=v)
        return qs


class PPEIssuanceDetail(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PPEIssuanceSerializer
    queryset = PPEIssuance.objects.all()


class HSEDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        month_start = today.replace(day=1)
        pid = request.query_params.get('project_id')

        incidents_qs = HSEIncident.objects.filter(project_id=pid) if pid else HSEIncident.objects.all()
        talks_qs = ToolboxTalk.objects.filter(project_id=pid) if pid else ToolboxTalk.objects.all()
        inductions_qs = SiteInduction.objects.filter(project_id=pid) if pid else SiteInduction.objects.all()
        ppe_qs = PPEIssuance.objects.filter(project_id=pid) if pid else PPEIssuance.objects.all()

        open_incidents = incidents_qs.filter(status__in=['open', 'investigating'])
        overdue_actions = sum(1 for i in open_incidents if i.is_overdue)

        by_type = list(incidents_qs.values('incident_type').annotate(count=Count('id')).order_by('-count'))
        by_severity = list(incidents_qs.values('severity').annotate(count=Count('id')).order_by('-count'))

        return Response({
            'open_incidents': open_incidents.count(),
            'overdue_actions': overdue_actions,
            'talks_this_month': talks_qs.filter(date__gte=month_start).count(),
            'total_inducted': inductions_qs.count(),
            'expired_inductions': sum(1 for i in inductions_qs if i.is_expired),
            'total_incidents': incidents_qs.count(),
            'closed_incidents': incidents_qs.filter(status='closed').count(),
            'ppe_issued_this_month': ppe_qs.filter(issue_date__gte=month_start).count(),
            'by_type': by_type,
            'by_severity': by_severity,
            'recent_incidents': HSEIncidentSerializer(
                incidents_qs.order_by('-date')[:5], many=True, context={'request': request}
            ).data,
            'recent_talks': ToolboxTalkSerializer(
                talks_qs.order_by('-date')[:5], many=True, context={'request': request}
            ).data,
        })
