from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from core.permissions import IsProcurementOfficer, IsFinanceManager, IsManagingDirector
from .models import Supplier, PurchaseRequisition, PRApproval, PurchaseOrder, PRStatus
from .serializers import (
    SupplierSerializer,
    PurchaseRequisitionSerializer,
    PurchaseOrderSerializer,
)


class SupplierListCreateView(generics.ListCreateAPIView):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    filterset_fields = ["status"]
    search_fields = ["company_name", "kra_pin", "contact_person"]

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsProcurementOfficer()]
        return super().get_permissions()


class SupplierDetailView(generics.RetrieveUpdateAPIView):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsProcurementOfficer]


class PRListCreateView(generics.ListCreateAPIView):
    serializer_class = PurchaseRequisitionSerializer
    filterset_fields = ["status", "project", "department"]
    search_fields = ["pr_number"]

    def get_queryset(self):
        return PurchaseRequisition.objects.select_related(
            "requested_by", "department", "project"
        ).prefetch_related("line_items", "approvals")

    def perform_create(self, serializer):
        serializer.save(requested_by=self.request.user, status=PRStatus.DRAFT)


class PRDetailView(generics.RetrieveUpdateAPIView):
    queryset = PurchaseRequisition.objects.prefetch_related("line_items", "approvals")
    serializer_class = PurchaseRequisitionSerializer


class PRApproveView(APIView):
    """Advance a PR through the approval chain."""

    STAGE_TRANSITIONS = {
        PRStatus.DRAFT: (PRStatus.PENDING, "submission"),
        PRStatus.PENDING: (PRStatus.DEPT_APPROVED, "dept_approval"),
        PRStatus.DEPT_APPROVED: (PRStatus.PROCUREMENT_REVIEW, "procurement_review"),
        PRStatus.PROCUREMENT_REVIEW: (PRStatus.FINANCE_APPROVED, "finance_approval"),
        PRStatus.FINANCE_APPROVED: (PRStatus.MD_APPROVED, "md_approval"),
    }

    def post(self, request, pk):
        pr = get_object_or_404(PurchaseRequisition, pk=pk)
        action = request.data.get("action")
        comment = request.data.get("comment", "")

        if action == "reject":
            pr.status = PRStatus.REJECTED
            pr.rejection_reason = comment
            pr.save()
            PRApproval.objects.create(
                pr=pr, approved_by=request.user,
                action="rejected", stage=pr.status, comment=comment
            )
            return Response({"detail": "PR rejected.", "status": pr.status})

        if pr.status not in self.STAGE_TRANSITIONS:
            return Response(
                {"detail": "PR cannot be advanced from current status."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        next_status, stage_name = self.STAGE_TRANSITIONS[pr.status]
        pr.status = next_status
        pr.save()
        PRApproval.objects.create(
            pr=pr, approved_by=request.user,
            action="approved", stage=stage_name, comment=comment
        )
        return Response({"detail": "PR advanced.", "status": pr.status})


class POListCreateView(generics.ListCreateAPIView):
    serializer_class = PurchaseOrderSerializer
    filterset_fields = ["status", "supplier", "project"]
    search_fields = ["po_number"]

    def get_queryset(self):
        return PurchaseOrder.objects.select_related("supplier", "project").prefetch_related(
            "line_items"
        )

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsProcurementOfficer()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class PODetailView(generics.RetrieveUpdateAPIView):
    queryset = PurchaseOrder.objects.prefetch_related("line_items")
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsProcurementOfficer]
