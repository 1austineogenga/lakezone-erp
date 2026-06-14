from rest_framework import generics
from core.permissions import IsSalesOfficer
from .models import Client, TenderOpportunity
from .serializers import ClientSerializer, TenderOpportunitySerializer


class ClientListCreateView(generics.ListCreateAPIView):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsSalesOfficer]
    search_fields = ["company_name", "contact_person", "email"]


class ClientDetailView(generics.RetrieveUpdateAPIView):
    queryset = Client.objects.all()
    serializer_class = ClientSerializer
    permission_classes = [IsSalesOfficer]


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
