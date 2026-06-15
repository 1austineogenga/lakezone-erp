from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Count, Q
from django.utils import timezone

from .models import (
    Project, BOQ, BOQBill, BOQItem, Budget, BudgetRate, BudgetLineItem,
    IPC, IPCItem, ProjectRisk, ProjectVehicle, ProjectPersonnel, WeeklyProgress
)
from .serializers import (
    ProjectSerializer, ProjectDetailSerializer, BOQSerializer, BOQBillSerializer,
    BOQItemSerializer, BudgetSerializer, BudgetRateSerializer, BudgetLineItemSerializer,
    IPCSerializer, IPCItemSerializer, ProjectRiskSerializer, ProjectVehicleSerializer,
    ProjectPersonnelSerializer, WeeklyProgressSerializer
)
from .services import BOQImportService
import openpyxl
from decimal import Decimal, InvalidOperation
import datetime


def _safe_decimal(v):
    try:
        return Decimal(str(v)) if v not in (None, '') else Decimal('0')
    except (InvalidOperation, ValueError):
        return Decimal('0')


def _safe_date(v):
    if not v:
        return None
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.date() if isinstance(v, datetime.datetime) else v
    try:
        return datetime.datetime.strptime(str(v).strip(), '%Y-%m-%d').date()
    except ValueError:
        try:
            return datetime.datetime.strptime(str(v).strip(), '%d/%m/%Y').date()
        except ValueError:
            return None


class ProjectImportView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            wb = openpyxl.load_workbook(file, data_only=True)
            ws = wb.active
        except Exception as e:
            return Response({'error': f'Could not read file: {e}'}, status=status.HTTP_400_BAD_REQUEST)

        # Find header row — look for a row containing "code" or "project"
        header_row = None
        headers = {}
        for row in ws.iter_rows(max_row=10, values_only=True):
            row_lower = [str(c).strip().lower() if c else '' for c in row]
            if any(k in row_lower for k in ('code', 'project code', 'name', 'project name')):
                header_row = row_lower
                break

        if header_row is None:
            return Response({'error': 'Could not find header row. Expected columns: Code, Name, Client, Contract Number, Contract Value, Location, Start Date, End Date, Status'}, status=status.HTTP_400_BAD_REQUEST)

        # Map column names to indices
        col_map = {
            'code':             ['code', 'project code', 'proj code'],
            'name':             ['name', 'project name', 'project'],
            'client':           ['client', 'client name', 'employer'],
            'contract_number':  ['contract number', 'contract no', 'contract no.', 'contract#'],
            'contract_value':   ['contract value', 'value', 'contract amount', 'amount'],
            'location':         ['location', 'site', 'site location'],
            'start_date':       ['start date', 'start', 'commencement date'],
            'end_date':         ['end date', 'end', 'completion date', 'expected completion'],
            'status':           ['status'],
            'description':      ['description', 'notes', 'remarks'],
        }
        idx = {}
        for field, aliases in col_map.items():
            for i, h in enumerate(header_row):
                if h in aliases:
                    idx[field] = i
                    break

        if 'code' not in idx or 'name' not in idx:
            return Response({'error': f'Missing required columns. Found: {header_row}. Need at least "Code" and "Name".'}, status=status.HTTP_400_BAD_REQUEST)

        STATUS_MAP = {
            'planning': 'planning', 'plan': 'planning',
            'active': 'active', 'ongoing': 'active', 'in progress': 'active',
            'on hold': 'on_hold', 'hold': 'on_hold', 'on_hold': 'on_hold',
            'completed': 'completed', 'complete': 'completed', 'done': 'completed',
            'suspended': 'suspended', 'stopped': 'suspended',
        }

        created, updated, skipped = [], [], []
        data_started = False

        for row in ws.iter_rows(values_only=True):
            # Skip until past header
            row_vals = [str(c).strip().lower() if c else '' for c in row]
            if not data_started:
                if any(k in row_vals for k in ('code', 'project code', 'name')):
                    data_started = True
                continue

            def g(field, default=''):
                i = idx.get(field)
                if i is None or i >= len(row):
                    return default
                v = row[i]
                return str(v).strip() if v is not None else default

            code = g('code')
            name = g('name')
            if not code or not name:
                continue

            raw_status = g('status', 'planning').lower()
            proj_status = STATUS_MAP.get(raw_status, 'planning')

            defaults = {
                'name':            name,
                'client':          g('client'),
                'contract_number': g('contract_number'),
                'contract_value':  _safe_decimal(g('contract_value', '0')),
                'location':        g('location'),
                'start_date':      _safe_date(g('start_date')),
                'end_date':        _safe_date(g('end_date')),
                'status':          proj_status,
                'description':     g('description'),
            }

            try:
                obj, was_created = Project.objects.update_or_create(code=code, defaults=defaults)
                (created if was_created else updated).append(code)
            except Exception as e:
                skipped.append({'code': code, 'reason': str(e)})

        return Response({
            'created': len(created),
            'updated': len(updated),
            'skipped': len(skipped),
            'skipped_detail': skipped,
            'created_codes': created,
            'updated_codes': updated,
        }, status=status.HTTP_201_CREATED)


class ProjectListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer


class ProjectDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    queryset = Project.objects.all()
    serializer_class = ProjectDetailSerializer
    lookup_field = 'pk'
    lookup_url_kwarg = 'project_pk'


class BOQListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BOQSerializer

    def get_queryset(self):
        return BOQ.objects.filter(project_id=self.kwargs['project_pk'])

    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs['project_pk'])
        serializer.save(project=project)


class BOQDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BOQSerializer

    def get_queryset(self):
        return BOQ.objects.filter(project_id=self.kwargs['project_pk'])


class BOQImportView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request, project_pk):
        project = get_object_or_404(Project, pk=project_pk)
        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)
        title = request.data.get('title', file.name)
        result = BOQImportService.import_from_excel(file, project.id, title)
        return Response(result, status=status.HTTP_201_CREATED)


class BudgetListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BudgetSerializer

    def get_queryset(self):
        return Budget.objects.filter(project_id=self.kwargs['project_pk'])

    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs['project_pk'])
        serializer.save(project=project)


class BudgetDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BudgetSerializer

    def get_queryset(self):
        return Budget.objects.filter(project_id=self.kwargs['project_pk'])

    def get_object(self):
        return get_object_or_404(Budget, pk=self.kwargs['budget_pk'], project_id=self.kwargs['project_pk'])


class BudgetLineItemListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BudgetLineItemSerializer

    def get_queryset(self):
        return BudgetLineItem.objects.filter(
            budget_id=self.kwargs['budget_pk'],
            budget__project_id=self.kwargs['project_pk'],
        )

    def perform_create(self, serializer):
        budget = get_object_or_404(Budget, pk=self.kwargs['budget_pk'], project_id=self.kwargs['project_pk'])
        serializer.save(budget=budget)


class BudgetLineItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = BudgetLineItemSerializer

    def get_queryset(self):
        return BudgetLineItem.objects.filter(
            budget_id=self.kwargs['budget_pk'],
            budget__project_id=self.kwargs['project_pk'],
        )


class BudgetSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, project_pk, budget_pk):
        budget = get_object_or_404(Budget, pk=budget_pk, project_id=project_pk)
        qs = BudgetLineItem.objects.filter(budget=budget)

        by_category = list(
            qs.values('category').annotate(
                base_total=Sum('base_cost'),
                high_total=Sum('high_case_cost'),
                low_total=Sum('low_case_cost'),
                count=Count('id')
            ).order_by('category')
        )

        # by_week aggregation across categories
        week_qs = qs.filter(week_no__isnull=False)
        by_week_raw = list(
            week_qs.values('week_no', 'category').annotate(
                base_total=Sum('base_cost'),
                high_total=Sum('high_case_cost'),
            ).order_by('week_no', 'category')
        )
        weeks = {}
        for row in by_week_raw:
            wn = row['week_no']
            if wn not in weeks:
                weeks[wn] = {'week_no': wn, 'materials': 0, 'fuel': 0, 'labour': 0, 'casuals': 0, 'base_total': 0, 'high_total': 0}
            cat = row['category']
            weeks[wn]['base_total'] = float(weeks[wn]['base_total']) + float(row['base_total'] or 0)
            weeks[wn]['high_total'] = float(weeks[wn]['high_total']) + float(row['high_total'] or 0)
            if cat in ('materials', 'fuel', 'labour', 'casuals'):
                weeks[wn][cat] = float(weeks[wn].get(cat, 0)) + float(row['base_total'] or 0)
        by_week = sorted(weeks.values(), key=lambda x: x['week_no'])

        by_month = list(
            qs.filter(month_no__isnull=False).values('month_no').annotate(
                base_total=Sum('base_cost'),
                high_total=Sum('high_case_cost'),
            ).order_by('month_no')
        )

        totals_agg = qs.aggregate(
            base=Sum('base_cost'),
            low=Sum('low_case_cost'),
            high=Sum('high_case_cost'),
            variance_reserve=Sum('variance_reserve'),
        )

        return Response({
            'by_category': by_category,
            'by_week': by_week,
            'by_month': by_month,
            'totals': {
                'base': float(totals_agg['base'] or 0),
                'low': float(totals_agg['low'] or 0),
                'high': float(totals_agg['high'] or 0),
                'variance_reserve': float(totals_agg['variance_reserve'] or 0),
            }
        })


class IPCListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = IPCSerializer

    def get_queryset(self):
        return IPC.objects.filter(project_id=self.kwargs['project_pk'])

    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs['project_pk'])
        serializer.save(project=project)


class IPCDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = IPCSerializer

    def get_queryset(self):
        return IPC.objects.filter(project_id=self.kwargs['project_pk'])

    def get_object(self):
        return get_object_or_404(IPC, pk=self.kwargs['ipc_pk'], project_id=self.kwargs['project_pk'])


class IPCItemListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = IPCItemSerializer

    def get_queryset(self):
        return IPCItem.objects.filter(
            ipc_id=self.kwargs['ipc_pk'],
            ipc__project_id=self.kwargs['project_pk'],
        )

    def perform_create(self, serializer):
        ipc = get_object_or_404(IPC, pk=self.kwargs['ipc_pk'], project_id=self.kwargs['project_pk'])
        serializer.save(ipc=ipc)


class IPCItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = IPCItemSerializer

    def get_queryset(self):
        return IPCItem.objects.filter(
            ipc_id=self.kwargs['ipc_pk'],
            ipc__project_id=self.kwargs['project_pk'],
        )


class ProjectRiskListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectRiskSerializer

    def get_queryset(self):
        return ProjectRisk.objects.filter(project_id=self.kwargs['project_pk'])

    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs['project_pk'])
        serializer.save(project=project)


class ProjectRiskDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectRiskSerializer

    def get_queryset(self):
        return ProjectRisk.objects.filter(project_id=self.kwargs['project_pk'])


class ProjectVehicleListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectVehicleSerializer

    def get_queryset(self):
        return ProjectVehicle.objects.filter(project_id=self.kwargs['project_pk'])

    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs['project_pk'])
        serializer.save(project=project)


class ProjectVehicleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectVehicleSerializer

    def get_queryset(self):
        return ProjectVehicle.objects.filter(project_id=self.kwargs['project_pk'])


class ProjectPersonnelListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectPersonnelSerializer

    def get_queryset(self):
        return ProjectPersonnel.objects.filter(project_id=self.kwargs['project_pk'])

    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs['project_pk'])
        serializer.save(project=project)


class ProjectPersonnelDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectPersonnelSerializer

    def get_queryset(self):
        return ProjectPersonnel.objects.filter(project_id=self.kwargs['project_pk'])


class WeeklyProgressListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = WeeklyProgressSerializer

    def get_queryset(self):
        return WeeklyProgress.objects.filter(project_id=self.kwargs['project_pk'])

    def perform_create(self, serializer):
        project = get_object_or_404(Project, pk=self.kwargs['project_pk'])
        serializer.save(project=project)


class WeeklyProgressDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = WeeklyProgressSerializer

    def get_queryset(self):
        return WeeklyProgress.objects.filter(project_id=self.kwargs['project_pk'])


class ProjectDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, project_pk):
        project = get_object_or_404(Project, pk=project_pk)

        # Budget summary
        budget_agg = BudgetLineItem.objects.filter(budget__project=project).aggregate(
            base_total=Sum('base_cost'),
            high_total=Sum('high_case_cost'),
            materials=Sum('base_cost', filter=Q(category='materials')),
            fuel=Sum('base_cost', filter=Q(category='fuel')),
            labour=Sum('base_cost', filter=Q(category='labour')),
            casuals=Sum('base_cost', filter=Q(category='casuals')),
        )

        # IPC summary
        ipc_agg = IPC.objects.filter(project=project).aggregate(
            total_claimed=Sum('amount_claimed'),
            total_certified=Sum('amount_certified'),
            total_paid=Sum('amount_paid'),
            ipc_count=Count('id'),
            pending_count=Count('id', filter=Q(status__in=['submitted', 'draft'])),
        )

        # Risk summary
        risk_agg = ProjectRisk.objects.filter(project=project).aggregate(
            open_count=Count('id', filter=Q(status='open')),
            high_count=Count('id', filter=Q(impact_level='high')),
            critical_count=Count('id', filter=Q(impact_level='critical')),
            mitigated_count=Count('id', filter=Q(status='mitigated')),
        )

        vehicle_count = ProjectVehicle.objects.filter(project=project).count()
        active_vehicle_count = ProjectVehicle.objects.filter(project=project, is_active=True).count()
        personnel_count = ProjectPersonnel.objects.filter(project=project).count()

        latest_progress = WeeklyProgress.objects.filter(project=project).order_by('-week_no').first()
        latest_progress_data = None
        if latest_progress:
            latest_progress_data = {
                'week_no': latest_progress.week_no,
                'total_actual': float(latest_progress.total_actual),
                'progress_notes': latest_progress.progress_notes,
            }

        weeks_elapsed = WeeklyProgress.objects.filter(project=project).count()

        return Response({
            'project': {
                'id': str(project.id),
                'code': project.code,
                'name': project.name,
                'contract_value': float(project.contract_value),
                'status': project.status,
                'start_date': project.start_date,
                'end_date': project.end_date,
            },
            'budget_summary': {
                'base_total': float(budget_agg['base_total'] or 0),
                'high_total': float(budget_agg['high_total'] or 0),
                'materials': float(budget_agg['materials'] or 0),
                'fuel': float(budget_agg['fuel'] or 0),
                'labour': float(budget_agg['labour'] or 0),
                'casuals': float(budget_agg['casuals'] or 0),
            },
            'ipc_summary': {
                'total_claimed': float(ipc_agg['total_claimed'] or 0),
                'total_certified': float(ipc_agg['total_certified'] or 0),
                'total_paid': float(ipc_agg['total_paid'] or 0),
                'ipc_count': ipc_agg['ipc_count'],
                'pending_count': ipc_agg['pending_count'],
            },
            'risk_summary': {
                'open_count': risk_agg['open_count'],
                'high_count': risk_agg['high_count'],
                'critical_count': risk_agg['critical_count'],
                'mitigated_count': risk_agg['mitigated_count'],
            },
            'fleet_summary': {
                'vehicle_count': vehicle_count,
                'active_count': active_vehicle_count,
            },
            'personnel_count': personnel_count,
            'latest_progress': latest_progress_data,
            'weeks_elapsed': weeks_elapsed,
        })
