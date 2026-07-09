from rest_framework import generics, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count
from django.utils import timezone

from .models import QualityInspection, NCR, MaterialTest, PunchListItem
from .serializers import (
    QualityInspectionSerializer, NCRSerializer,
    MaterialTestSerializer, PunchListItemSerializer,
)


class QualityInspectionListCreate(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = QualityInspectionSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['activity_description', 'location', 'inspector_name', 'project_name']
    ordering = ['-inspection_date', '-created_at']

    def get_queryset(self):
        qs = QualityInspection.objects.all()
        if pid := self.request.query_params.get('project_id'):
            qs = qs.filter(project_id=pid)
        if v := self.request.query_params.get('result'):
            qs = qs.filter(result=v)
        if v := self.request.query_params.get('category'):
            qs = qs.filter(category=v)
        return qs


class QualityInspectionDetail(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = QualityInspectionSerializer
    queryset = QualityInspection.objects.all()


class NCRListCreate(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NCRSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['description', 'location', 'ncr_number', 'project_name']
    ordering = ['-date_raised', '-created_at']

    def get_queryset(self):
        qs = NCR.objects.all()
        if pid := self.request.query_params.get('project_id'):
            qs = qs.filter(project_id=pid)
        if v := self.request.query_params.get('status'):
            qs = qs.filter(status=v)
        if v := self.request.query_params.get('severity'):
            qs = qs.filter(severity=v)
        return qs


class NCRDetail(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NCRSerializer
    queryset = NCR.objects.all()


class MaterialTestListCreate(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MaterialTestSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['sample_id', 'location', 'tested_by', 'project_name']
    ordering = ['-test_date', '-created_at']

    def get_queryset(self):
        qs = MaterialTest.objects.all()
        if pid := self.request.query_params.get('project_id'):
            qs = qs.filter(project_id=pid)
        if v := self.request.query_params.get('test_type'):
            qs = qs.filter(test_type=v)
        if v := self.request.query_params.get('result'):
            qs = qs.filter(result=v)
        return qs


class MaterialTestDetail(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MaterialTestSerializer
    queryset = MaterialTest.objects.all()


class PunchListItemListCreate(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PunchListItemSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['description', 'location', 'assigned_to', 'project_name']
    ordering = ['status', '-priority', 'due_date']

    def get_queryset(self):
        qs = PunchListItem.objects.all()
        if pid := self.request.query_params.get('project_id'):
            qs = qs.filter(project_id=pid)
        if v := self.request.query_params.get('status'):
            qs = qs.filter(status=v)
        return qs


class PunchListItemDetail(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PunchListItemSerializer
    queryset = PunchListItem.objects.all()


class QCDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()
        month_start = today.replace(day=1)
        pid = request.query_params.get('project_id')

        insp_qs = QualityInspection.objects.filter(project_id=pid) if pid else QualityInspection.objects.all()
        ncr_qs  = NCR.objects.filter(project_id=pid) if pid else NCR.objects.all()
        test_qs = MaterialTest.objects.filter(project_id=pid) if pid else MaterialTest.objects.all()
        punch_qs = PunchListItem.objects.filter(project_id=pid) if pid else PunchListItem.objects.all()

        open_ncrs = ncr_qs.filter(status__in=['open', 'in_review'])
        overdue_ncrs = sum(1 for n in open_ncrs if n.is_overdue)
        open_punch = punch_qs.filter(status__in=['open', 'in_progress'])
        overdue_punch = sum(1 for p in open_punch if p.is_overdue)

        return Response({
            'total_inspections': insp_qs.count(),
            'passed': insp_qs.filter(result='pass').count(),
            'failed': insp_qs.filter(result='fail').count(),
            'open_ncrs': open_ncrs.count(),
            'overdue_ncrs': overdue_ncrs,
            'closed_ncrs': ncr_qs.filter(status='closed').count(),
            'total_tests': test_qs.count(),
            'tests_passed': test_qs.filter(result='pass').count(),
            'tests_failed': test_qs.filter(result='fail').count(),
            'open_punch_items': open_punch.count(),
            'overdue_punch': overdue_punch,
            'closed_punch': punch_qs.filter(status='closed').count(),
            'inspections_this_month': insp_qs.filter(inspection_date__gte=month_start).count(),
            'by_category': list(insp_qs.values('category').annotate(count=Count('id')).order_by('-count')),
            'by_result': list(insp_qs.values('result').annotate(count=Count('id'))),
            'recent_ncrs': NCRSerializer(ncr_qs.order_by('-date_raised')[:5], many=True).data,
            'recent_inspections': QualityInspectionSerializer(insp_qs.order_by('-inspection_date')[:5], many=True).data,
        })
