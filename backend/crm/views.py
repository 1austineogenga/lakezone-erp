from rest_framework import generics, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from django.db.models import Count, Sum
from core.permissions import IsSalesOfficer
from .models import Client, TenderOpportunity, ClientInteraction, OpportunityStage
from .serializers import ClientSerializer, TenderOpportunitySerializer, ClientInteractionSerializer


class ClientListCreateView(generics.ListCreateAPIView):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsSalesOfficer]
    search_fields = ["company_name", "contact_person", "email"]


class ClientDetailView(generics.RetrieveUpdateAPIView):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsSalesOfficer]


class ClientInteractionListCreateView(generics.ListCreateAPIView):
    serializer_class = ClientInteractionSerializer
    permission_classes = [IsSalesOfficer]

    def get_queryset(self):
        return ClientInteraction.objects.filter(client_id=self.kwargs['client_pk'])

    def perform_create(self, serializer):
        client = Client.objects.get(pk=self.kwargs['client_pk'])
        serializer.save(client=client, created_by=self.request.user)


class ClientInteractionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ClientInteractionSerializer
    permission_classes = [IsSalesOfficer]

    def get_queryset(self):
        return ClientInteraction.objects.filter(client_id=self.kwargs['client_pk'])


class TenderOpportunityListCreateView(generics.ListCreateAPIView):
    queryset = TenderOpportunity.objects.select_related("client", "assigned_to")
    serializer_class = TenderOpportunitySerializer
    permission_classes = [IsSalesOfficer]
    filterset_fields = ["stage", "client", "assigned_to"]
    search_fields = ["opportunity_name", "tender_number"]

    def perform_create(self, serializer):
        serializer.save(assigned_to=self.request.user)


class TenderOpportunityDetailView(generics.RetrieveUpdateAPIView):
    queryset = TenderOpportunity.objects.all()
    serializer_class = TenderOpportunitySerializer
    permission_classes = [IsSalesOfficer]


class PipelineView(APIView):
    """
    GET /api/v1/crm/pipeline/
    Returns pipeline statistics: count/value by stage, win rate, weighted value.
    """
    permission_classes = [IsSalesOfficer]

    def get(self, request):
        qs = TenderOpportunity.objects.all()

        # Count and total estimated value by stage
        by_stage = {}
        for stage_val, stage_label in OpportunityStage.choices:
            agg = qs.filter(stage=stage_val).aggregate(
                count=Count('id'),
                total_value=Sum('estimated_value'),
            )
            by_stage[stage_val] = {
                'label': stage_label,
                'count': agg['count'],
                'total_estimated_value': agg['total_value'] or 0,
            }

        # Win rate: won / (won + lost)
        won_count  = qs.filter(stage=OpportunityStage.WON).count()
        lost_count = qs.filter(stage=OpportunityStage.LOST).count()
        total_decided = won_count + lost_count
        win_rate = (won_count / total_decided) if total_decided > 0 else None

        # Weighted pipeline value: sum of (probability_percent/100 * estimated_value)
        # Only for open stages (exclude WON and LOST)
        open_opps = qs.exclude(
            stage__in=[OpportunityStage.WON, OpportunityStage.LOST]
        ).exclude(
            probability_percent__isnull=True
        ).exclude(
            estimated_value__isnull=True
        )
        weighted_value = sum(
            float(o.estimated_value) * (o.probability_percent / 100)
            for o in open_opps
        )

        return Response({
            'by_stage': by_stage,
            'win_rate': win_rate,
            'weighted_pipeline_value': round(weighted_value, 2),
        })
