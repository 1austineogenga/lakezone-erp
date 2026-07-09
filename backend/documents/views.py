from rest_framework import generics, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from .models import Drawing, RFI, Submittal
from .serializers import DrawingSerializer, RFISerializer, SubmittalSerializer


class DrawingListCreate(generics.ListCreateAPIView):
    serializer_class = DrawingSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project_id', 'discipline', 'status']
    search_fields = ['drawing_number', 'title', 'drawn_by']
    ordering_fields = ['drawing_number', 'issue_date', 'created_at']

    def get_queryset(self):
        return Drawing.objects.select_related('uploaded_by').all()

    def get_serializer_context(self):
        return {'request': self.request}


class DrawingDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Drawing.objects.all()
    serializer_class = DrawingSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_context(self):
        return {'request': self.request}


class RFIListCreate(generics.ListCreateAPIView):
    serializer_class = RFISerializer
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project_id', 'status']
    search_fields = ['rfi_number', 'subject', 'raised_by', 'directed_to']
    ordering_fields = ['date_raised', 'response_due', 'created_at']

    def get_queryset(self):
        return RFI.objects.select_related('created_by').all()

    def get_serializer_context(self):
        return {'request': self.request}


class RFIDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = RFI.objects.all()
    serializer_class = RFISerializer

    def get_serializer_context(self):
        return {'request': self.request}


class SubmittalListCreate(generics.ListCreateAPIView):
    serializer_class = SubmittalSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['project_id', 'submittal_type', 'status']
    search_fields = ['submittal_number', 'title', 'submitted_by', 'reviewer']
    ordering_fields = ['date_submitted', 'review_due', 'created_at']

    def get_queryset(self):
        return Submittal.objects.select_related('created_by').all()

    def get_serializer_context(self):
        return {'request': self.request}


class SubmittalDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Submittal.objects.all()
    serializer_class = SubmittalSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_serializer_context(self):
        return {'request': self.request}


class DocumentDashboardView(APIView):
    def get(self, request):
        today = timezone.now().date()
        drawings     = Drawing.objects.all()
        rfis         = RFI.objects.all()
        submittals   = Submittal.objects.all()

        proj = request.query_params.get('project_id')
        if proj:
            drawings   = drawings.filter(project_id=proj)
            rfis       = rfis.filter(project_id=proj)
            submittals = submittals.filter(project_id=proj)

        open_rfis     = rfis.filter(status='open')
        overdue_rfis  = [r for r in open_rfis if r.is_overdue]
        pending_subs  = submittals.filter(status__in=['submitted', 'under_review'])
        overdue_subs  = [s for s in pending_subs if s.is_overdue]

        by_discipline = {}
        for d in drawings.values('discipline'):
            disc = d['discipline']
            by_discipline[disc] = by_discipline.get(disc, 0) + 1

        by_status_rfi = {}
        for r in rfis.values('status'):
            s = r['status']
            by_status_rfi[s] = by_status_rfi.get(s, 0) + 1

        by_status_sub = {}
        for s in submittals.values('status'):
            st = s['status']
            by_status_sub[st] = by_status_sub.get(st, 0) + 1

        return Response({
            'total_drawings':   drawings.count(),
            'total_rfis':       rfis.count(),
            'open_rfis':        open_rfis.count(),
            'overdue_rfis':     len(overdue_rfis),
            'total_submittals': submittals.count(),
            'pending_submittals': pending_subs.count(),
            'overdue_submittals': len(overdue_subs),
            'ifc_drawings':     drawings.filter(status='issued_for_construction').count(),
            'by_discipline':    by_discipline,
            'by_status_rfi':    by_status_rfi,
            'by_status_sub':    by_status_sub,
            'recent_rfis':      RFISerializer(rfis.order_by('-created_at')[:5], many=True, context={'request': request}).data,
            'recent_submittals':SubmittalSerializer(submittals.order_by('-created_at')[:5], many=True, context={'request': request}).data,
        })
