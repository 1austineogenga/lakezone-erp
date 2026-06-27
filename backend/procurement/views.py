from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from core.permissions import IsProcurementOfficer, IsFinanceManager, IsManagingDirector
from .models import (
    Supplier, SupplierStatus, PurchaseRequisition, PRApproval,
    PurchaseOrder, POStatus, PRStatus,
    GoodsReceivedNote, GRNStatus,
)
from .serializers import (
    SupplierSerializer,
    PurchaseRequisitionSerializer,
    PurchaseOrderSerializer,
    GoodsReceivedNoteSerializer,
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


class SupplierBlacklistView(APIView):
    """Blacklist a supplier."""
    permission_classes = [IsProcurementOfficer]

    def post(self, request, pk):
        supplier = get_object_or_404(Supplier, pk=pk)
        if supplier.status == SupplierStatus.BLACKLISTED:
            return Response({"detail": "Supplier is already blacklisted."}, status=status.HTTP_400_BAD_REQUEST)
        reason = request.data.get("reason", "")
        if not reason:
            return Response({"detail": "A reason is required to blacklist a supplier."}, status=status.HTTP_400_BAD_REQUEST)
        supplier.status = SupplierStatus.BLACKLISTED
        supplier.blacklist_reason = reason
        supplier.save(update_fields=["status", "blacklist_reason"])
        return Response({"detail": "Supplier blacklisted.", "status": supplier.status})


class SupplierReinstateView(APIView):
    """Reinstate a blacklisted supplier to active."""
    permission_classes = [IsProcurementOfficer]

    def post(self, request, pk):
        supplier = get_object_or_404(Supplier, pk=pk)
        if supplier.status != SupplierStatus.BLACKLISTED:
            return Response({"detail": "Supplier is not blacklisted."}, status=status.HTTP_400_BAD_REQUEST)
        supplier.status = SupplierStatus.ACTIVE
        supplier.blacklist_reason = ""
        supplier.save(update_fields=["status", "blacklist_reason"])
        return Response({"detail": "Supplier reinstated.", "status": supplier.status})


class SupplierRatingUpdateView(APIView):
    """Update a supplier's performance rating after PO completion."""
    permission_classes = [IsProcurementOfficer]

    def post(self, request, pk):
        supplier = get_object_or_404(Supplier, pk=pk)
        rating = request.data.get("performance_rating")
        if rating is None:
            return Response({"detail": "performance_rating is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            rating = float(rating)
        except (TypeError, ValueError):
            return Response({"detail": "performance_rating must be a number."}, status=status.HTTP_400_BAD_REQUEST)
        if not (0 <= rating <= 10):
            return Response({"detail": "performance_rating must be between 0 and 10."}, status=status.HTTP_400_BAD_REQUEST)
        supplier.performance_rating = rating
        supplier.save(update_fields=["performance_rating"])
        return Response({"detail": "Performance rating updated.", "performance_rating": supplier.performance_rating})


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


class POSendView(APIView):
    """Send a PO to the supplier (APPROVED -> SENT)."""
    permission_classes = [IsProcurementOfficer]

    def post(self, request, pk):
        po = get_object_or_404(PurchaseOrder, pk=pk)
        if po.status != POStatus.APPROVED:
            return Response(
                {"detail": f"PO must be in APPROVED status to send. Current status: {po.status}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        po.status = POStatus.SENT
        po.save(update_fields=["status"])
        return Response({"detail": "PO sent to supplier.", "status": po.status})


class POCancelView(APIView):
    """Cancel a PO. Cannot cancel if GRNs have been recorded against it."""
    permission_classes = [IsProcurementOfficer]

    def post(self, request, pk):
        po = get_object_or_404(PurchaseOrder, pk=pk)
        if po.status == POStatus.CANCELLED:
            return Response({"detail": "PO is already cancelled."}, status=status.HTTP_400_BAD_REQUEST)
        if po.goods_received_notes.exists():
            return Response(
                {"detail": "Cannot cancel a PO that has Goods Received Notes recorded against it."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reason = request.data.get("reason", "")
        if not reason:
            return Response({"detail": "A cancellation reason is required."}, status=status.HTTP_400_BAD_REQUEST)
        po.status = POStatus.CANCELLED
        po.cancellation_reason = reason
        po.save(update_fields=["status", "cancellation_reason"])
        return Response({"detail": "PO cancelled.", "status": po.status})


# ---------------------------------------------------------------------------
# GRN Views
# ---------------------------------------------------------------------------

class GRNListCreateView(generics.ListCreateAPIView):
    serializer_class = GoodsReceivedNoteSerializer
    filterset_fields = ["status", "purchase_order"]
    search_fields = ["grn_number"]

    def get_queryset(self):
        return GoodsReceivedNote.objects.select_related(
            "purchase_order", "received_by"
        ).prefetch_related("grn_items")

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsProcurementOfficer()]
        return super().get_permissions()

    def perform_create(self, serializer):
        serializer.save(received_by=self.request.user)


class GRNDetailView(generics.RetrieveUpdateAPIView):
    queryset = GoodsReceivedNote.objects.prefetch_related("grn_items")
    serializer_class = GoodsReceivedNoteSerializer
    permission_classes = [IsProcurementOfficer]


class GRNConfirmView(APIView):
    """Confirm a GRN — updates PO received quantities and creates stock transactions."""
    permission_classes = [IsProcurementOfficer]

    def post(self, request, pk):
        grn = get_object_or_404(GoodsReceivedNote, pk=pk)
        if grn.status == GRNStatus.CONFIRMED:
            return Response({"detail": "GRN is already confirmed."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            grn.confirm()
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"detail": "GRN confirmed.", "grn_number": grn.grn_number, "status": grn.status})
