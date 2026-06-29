from rest_framework import generics, permissions, filters
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
from .models import (
    ForemanDailyReport, ForemanWeeklyReport,
    SurveyorDailyReport, SurveyorWeeklyReport,
    MachineDailyReport, MachineWeeklyReport,
)
from .serializers import (
    ForemanDailyReportSerializer, ForemanWeeklyReportSerializer,
    SurveyorDailyReportSerializer, SurveyorWeeklyReportSerializer,
    MachineDailyReportSerializer, MachineWeeklyReportSerializer,
)

# Roles allowed to write (create/edit) each report type
FOREMAN_WRITE = {'site_foreman'}
SURVEYOR_WRITE = {'site_surveyor'}
MACHINE_WRITE = {'equipment_operator', 'driver'}

# Roles allowed to read all reports
READ_ALL = {
    'system_admin', 'managing_director', 'general_manager',
    'site_manager', 'site_engineer', 'admin_officer',
    'hr_manager', 'finance_officer', 'finance_manager',
}

ALL_WRITE = FOREMAN_WRITE | SURVEYOR_WRITE | MACHINE_WRITE


def _can_read(user):
    return user.role in READ_ALL or user.role in ALL_WRITE


def _check_editable(report, user):
    """Raise PermissionDenied if the report is locked."""
    if not report.is_editable:
        raise PermissionDenied('This report is locked for editing after midnight of its submission day.')
    if report.submitted_by_id != user.id:
        raise PermissionDenied('You can only edit your own reports.')


class BaseReportListCreate(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    ordering = ['-submitted_at']

    write_roles = set()

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset
        if user.role in READ_ALL:
            pass  # see all
        elif user.role in self.write_roles:
            qs = qs.filter(submitted_by=user)
        else:
            return qs.none()

        # Date filter
        date = self.request.query_params.get('date')
        if date:
            qs = qs.filter(date=date)

        # Week filter
        week_no = self.request.query_params.get('week_no')
        if week_no:
            qs = qs.filter(week_no=week_no)

        # Date range
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if date_from:
            qs = qs.filter(submitted_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(submitted_at__date__lte=date_to)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if user.role not in self.write_roles:
            raise PermissionDenied('You do not have permission to create this report type.')
        serializer.save(submitted_by=user)


class BaseReportDetail(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    write_roles = set()

    def get_queryset(self):
        user = self.request.user
        qs = self.queryset
        if user.role in READ_ALL:
            return qs
        if user.role in self.write_roles:
            return qs
        return qs.none()

    def perform_update(self, serializer):
        user = self.request.user
        if user.role not in self.write_roles:
            raise PermissionDenied('Read-only access.')
        _check_editable(serializer.instance, user)
        serializer.save()


# ── Foreman ──────────────────────────────────────────────────────────────────

class ForemanDailyListCreate(BaseReportListCreate):
    queryset = ForemanDailyReport.objects.all()
    serializer_class = ForemanDailyReportSerializer
    filterset_fields = ['date', 'project_name']
    write_roles = FOREMAN_WRITE


class ForemanDailyDetail(BaseReportDetail):
    queryset = ForemanDailyReport.objects.all()
    serializer_class = ForemanDailyReportSerializer
    write_roles = FOREMAN_WRITE


class ForemanWeeklyListCreate(BaseReportListCreate):
    queryset = ForemanWeeklyReport.objects.all()
    serializer_class = ForemanWeeklyReportSerializer
    filterset_fields = ['week_no', 'project_name']
    write_roles = FOREMAN_WRITE


class ForemanWeeklyDetail(BaseReportDetail):
    queryset = ForemanWeeklyReport.objects.all()
    serializer_class = ForemanWeeklyReportSerializer
    write_roles = FOREMAN_WRITE


# ── Surveyor ─────────────────────────────────────────────────────────────────

class SurveyorDailyListCreate(BaseReportListCreate):
    queryset = SurveyorDailyReport.objects.all()
    serializer_class = SurveyorDailyReportSerializer
    filterset_fields = ['date', 'project_name']
    write_roles = SURVEYOR_WRITE


class SurveyorDailyDetail(BaseReportDetail):
    queryset = SurveyorDailyReport.objects.all()
    serializer_class = SurveyorDailyReportSerializer
    write_roles = SURVEYOR_WRITE


class SurveyorWeeklyListCreate(BaseReportListCreate):
    queryset = SurveyorWeeklyReport.objects.all()
    serializer_class = SurveyorWeeklyReportSerializer
    filterset_fields = ['week_no', 'project_name']
    write_roles = SURVEYOR_WRITE


class SurveyorWeeklyDetail(BaseReportDetail):
    queryset = SurveyorWeeklyReport.objects.all()
    serializer_class = SurveyorWeeklyReportSerializer
    write_roles = SURVEYOR_WRITE


# ── Machine ──────────────────────────────────────────────────────────────────

class MachineDailyListCreate(BaseReportListCreate):
    queryset = MachineDailyReport.objects.all()
    serializer_class = MachineDailyReportSerializer
    filterset_fields = ['date', 'project_name', 'machine_id']
    write_roles = MACHINE_WRITE


class MachineDailyDetail(BaseReportDetail):
    queryset = MachineDailyReport.objects.all()
    serializer_class = MachineDailyReportSerializer
    write_roles = MACHINE_WRITE


class MachineWeeklyListCreate(BaseReportListCreate):
    queryset = MachineWeeklyReport.objects.all()
    serializer_class = MachineWeeklyReportSerializer
    filterset_fields = ['week_no', 'project_name', 'machine_id']
    write_roles = MACHINE_WRITE


class MachineWeeklyDetail(BaseReportDetail):
    queryset = MachineWeeklyReport.objects.all()
    serializer_class = MachineWeeklyReportSerializer
    write_roles = MACHINE_WRITE
