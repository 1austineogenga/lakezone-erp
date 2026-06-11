import csv
import io
from decimal import Decimal, InvalidOperation

from django.db.models import Sum, F
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
import openpyxl

from core.permissions import IsProjectManager, IsManagement
from .models import Project, Tender, BOQItem, ProjectDocument
from .serializers import (
    ProjectSerializer,
    ProjectListSerializer,
    TenderSerializer,
    TenderListSerializer,
    BOQItemSerializer,
    ProjectDocumentSerializer,
    BOQUploadSerializer,
)


class ProjectListCreateView(generics.ListCreateAPIView):
    queryset = Project.objects.select_related("project_manager").prefetch_related("tenders")
    filterset_fields = ["status", "project_manager"]
    search_fields = ["project_name", "contract_number", "client_name"]
    ordering_fields = ["created_at", "start_date", "contract_sum"]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return ProjectSerializer
        return ProjectListSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsProjectManager()]
        return super().get_permissions()


class ProjectDetailView(generics.RetrieveUpdateAPIView):
    queryset = Project.objects.select_related("project_manager", "created_by").prefetch_related(
        "tenders__boq_items"
    )
    serializer_class = ProjectSerializer

    def get_permissions(self):
        if self.request.method in ["PUT", "PATCH"]:
            return [IsProjectManager()]
        return super().get_permissions()


class ProjectCostingView(APIView):
    """Real-time cost analysis and variance report for a project."""

    def get(self, request, pk):
        project = get_object_or_404(Project, pk=pk)
        tenders = project.tenders.prefetch_related("boq_items")

        boq_totals = BOQItem.objects.filter(tender__project=project).aggregate(
            total_budget=Sum("total_cost"),
            total_actual=Sum("actual_cost"),
        )
        budget = boq_totals["total_budget"] or Decimal("0")
        actual = boq_totals["total_actual"] or Decimal("0")
        variance = budget - actual
        margin_pct = float((variance / budget) * 100) if budget else 0

        boq_breakdown = []
        for tender in tenders:
            for item in tender.boq_items.all():
                boq_breakdown.append({
                    "item_code": item.item_code,
                    "description": item.description[:80],
                    "budget": item.total_cost,
                    "actual": item.actual_cost,
                    "variance": item.budget_variance,
                    "progress_pct": item.progress_percent,
                    "cpi": item.cost_performance_index,
                })

        return Response({
            "project_id": str(project.id),
            "project_name": project.project_name,
            "contract_sum": project.contract_sum,
            "total_boq_budget": budget,
            "total_actual_cost": actual,
            "variance": variance,
            "margin_percent": round(margin_pct, 2),
            "boq_breakdown": boq_breakdown,
        })


class ProjectProgressView(APIView):
    """Physical and financial progress per project."""

    def get(self, request, pk):
        project = get_object_or_404(Project, pk=pk)
        items = BOQItem.objects.filter(tender__project=project)
        total_items = items.count()
        if total_items == 0:
            return Response({"detail": "No BOQ items found for this project."})

        avg_physical = items.aggregate(avg=Sum("progress_percent"))["avg"] or 0
        avg_physical = float(avg_physical) / total_items

        boq_budget = items.aggregate(total=Sum("total_cost"))["total"] or Decimal("0")
        boq_actual = items.aggregate(total=Sum("actual_cost"))["total"] or Decimal("0")
        financial_progress = float(boq_actual / boq_budget * 100) if boq_budget else 0

        return Response({
            "project_id": str(project.id),
            "physical_progress_percent": round(avg_physical, 2),
            "financial_progress_percent": round(financial_progress, 2),
            "boq_item_count": total_items,
        })


class ProjectDocumentView(generics.ListCreateAPIView):
    serializer_class = ProjectDocumentSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        return ProjectDocument.objects.filter(project_id=self.kwargs["pk"])

    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs["pk"])
        serializer.save(project=project, uploaded_by=self.request.user)


class TenderListCreateView(generics.ListCreateAPIView):
    filterset_fields = ["tender_status", "project"]
    search_fields = ["tender_number", "tender_description"]

    def get_queryset(self):
        return Tender.objects.filter(project_id=self.kwargs["project_pk"]).prefetch_related(
            "boq_items"
        )

    def get_serializer_class(self):
        if self.request.method == "POST":
            return TenderSerializer
        return TenderListSerializer

    def get_permissions(self):
        if self.request.method == "POST":
            return [IsProjectManager()]
        return super().get_permissions()

    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs["project_pk"])
        serializer.save(project=project, created_by=self.request.user)


class BOQListView(APIView):
    """Retrieve full BOQ for a project (all tenders combined)."""

    def get(self, request, pk):
        project = get_object_or_404(Project, pk=pk)
        items = BOQItem.objects.filter(tender__project=project).select_related("tender")
        serializer = BOQItemSerializer(items, many=True)
        return Response(serializer.data)


class BOQUploadView(APIView):
    """Upload BOQ from Excel (.xlsx) or CSV file."""

    parser_classes = [MultiPartParser, FormParser]
    permission_classes_by_method = {"POST": [IsProjectManager]}

    def post(self, request, pk):
        project = get_object_or_404(Project, pk=pk)
        serializer = BOQUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uploaded_file = serializer.validated_data["file"]
        file_format = serializer.validated_data["file_format"]

        tender_id = request.data.get("tender_id")
        tender = get_object_or_404(Tender, pk=tender_id, project=project)

        try:
            if file_format == "xlsx":
                items = self._parse_xlsx(uploaded_file, tender)
            else:
                items = self._parse_csv(uploaded_file, tender)
        except Exception as e:
            return Response({"detail": f"Parse error: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        BOQItem.objects.bulk_create(items)
        return Response(
            {"detail": f"{len(items)} BOQ items imported successfully."},
            status=status.HTTP_201_CREATED,
        )

    def _parse_xlsx(self, file, tender):
        wb = openpyxl.load_workbook(file, read_only=True, data_only=True)
        ws = wb.active
        items = []
        for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
            if not row[0]:
                continue
            items.append(BOQItem(
                tender=tender,
                item_code=str(row[0]),
                description=str(row[1] or ""),
                unit=str(row[2] or ""),
                quantity=Decimal(str(row[3] or 0)),
                unit_rate=Decimal(str(row[4] or 0)),
            ))
        return items

    def _parse_csv(self, file, tender):
        text = io.TextIOWrapper(file, encoding="utf-8")
        reader = csv.DictReader(text)
        items = []
        for row in reader:
            try:
                items.append(BOQItem(
                    tender=tender,
                    item_code=row.get("item_code", ""),
                    description=row.get("description", ""),
                    unit=row.get("unit", ""),
                    quantity=Decimal(row.get("quantity", "0")),
                    unit_rate=Decimal(row.get("unit_rate", "0")),
                ))
            except (InvalidOperation, KeyError):
                continue
        return items
