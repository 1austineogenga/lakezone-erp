from datetime import date, datetime, timedelta
from decimal import Decimal
from django.db import transaction
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.pagination import PageNumberPagination

from .models import (
    JobGrade, Position, Employee, EmployeeDocument,
    BiometricDevice, AttendanceRecord,
    LeaveType, LeaveBalance, LeaveApplication,
    PayrollPeriod, PayrollEntry, SalaryAdvance, DisciplinaryRecord,
    EmployeeTransfer, Casual, CasualDailyLog,
)
from .serializers import (
    JobGradeSerializer, PositionSerializer,
    EmployeeSerializer, EmployeeListSerializer, EmployeeDocumentSerializer,
    BiometricDeviceSerializer, AttendanceRecordSerializer,
    BulkAttendanceSerializer, BiometricPushSerializer,
    LeaveTypeSerializer, LeaveBalanceSerializer,
    LeaveApplicationSerializer, LeaveReviewSerializer,
    PayrollPeriodSerializer, PayrollEntrySerializer,
    SalaryAdvanceSerializer, AdvanceReviewSerializer,
    DisciplinaryRecordSerializer,
    EmployeeTransferSerializer, EmployeeTransferCreateSerializer, TransferReviewSerializer,
    CasualSerializer, CasualDailyLogSerializer,
)


# ── Job Grades & Positions ─────────────────────────────────────────────────────

class JobGradeListCreateView(generics.ListCreateAPIView):
    queryset           = JobGrade.objects.all()
    serializer_class   = JobGradeSerializer
    permission_classes = [IsAuthenticated]


class JobGradeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = JobGrade.objects.all()
    serializer_class   = JobGradeSerializer
    permission_classes = [IsAuthenticated]


class PositionListCreateView(generics.ListCreateAPIView):
    serializer_class   = PositionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Position.objects.select_related('department', 'job_grade')
        dept = self.request.query_params.get('department')
        if dept:
            qs = qs.filter(department_id=dept)
        return qs


class PositionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = Position.objects.select_related('department', 'job_grade')
    serializer_class   = PositionSerializer
    permission_classes = [IsAuthenticated]


# ── Employees ──────────────────────────────────────────────────────────────────

class EmployeePagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 1000


class EmployeeListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    pagination_class = EmployeePagination

    def get_serializer_class(self):
        if self.request.method == 'GET' and self.request.query_params.get('simple'):
            return EmployeeListSerializer
        return EmployeeSerializer

    def get_queryset(self):
        qs = Employee.objects.select_related('department', 'position', 'branch')
        params = self.request.query_params
        if q := params.get('q'):
            qs = qs.filter(
                Q(first_name__icontains=q) | Q(last_name__icontains=q) |
                Q(employee_number__icontains=q) | Q(phone__icontains=q)
            )
        if t := params.get('employment_type'):
            qs = qs.filter(employment_type=t)
        if d := params.get('department'):
            qs = qs.filter(department_id=d)
        if b := params.get('branch'):
            qs = qs.filter(branch_id=b)
        active = params.get('is_active')
        if active is not None:
            qs = qs.filter(is_active=(active.lower() == 'true'))
        return qs


class EmployeeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = Employee.objects.select_related('department', 'position', 'branch')
    serializer_class   = EmployeeSerializer
    permission_classes = [IsAuthenticated]


class EmployeeDocumentListCreateView(generics.ListCreateAPIView):
    serializer_class   = EmployeeDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = EmployeeDocument.objects.all()
        if emp := self.request.query_params.get('employee'):
            qs = qs.filter(employee_id=emp)
        return qs


class EmployeeDocumentDetailView(generics.RetrieveDestroyAPIView):
    queryset           = EmployeeDocument.objects.all()
    serializer_class   = EmployeeDocumentSerializer
    permission_classes = [IsAuthenticated]


# ── Biometric Devices ──────────────────────────────────────────────────────────

class BiometricDeviceListCreateView(generics.ListCreateAPIView):
    queryset           = BiometricDevice.objects.all()
    serializer_class   = BiometricDeviceSerializer
    permission_classes = [IsAuthenticated]


class BiometricDeviceDetailView(generics.RetrieveUpdateAPIView):
    queryset           = BiometricDevice.objects.all()
    serializer_class   = BiometricDeviceSerializer
    permission_classes = [IsAuthenticated]


class BiometricSyncView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            device = BiometricDevice.objects.get(pk=pk)
        except BiometricDevice.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        device.last_sync = datetime.now()
        device.save(update_fields=['last_sync'])
        return Response({'status': 'sync_triggered', 'device': device.name})


class BiometricPushView(APIView):
    """
    Endpoint for biometric devices to push attendance events.
    Authenticated by X-Device-Key header — no JWT required.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        api_key = request.headers.get('X-Device-Key') or request.data.get('api_key')
        if not api_key:
            return Response({'detail': 'Missing X-Device-Key header.'}, status=401)

        try:
            device = BiometricDevice.objects.get(api_key=api_key, is_active=True)
        except BiometricDevice.DoesNotExist:
            return Response({'detail': 'Invalid or inactive device key.'}, status=401)

        ser = BiometricPushSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)

        d = ser.validated_data
        if d['device_id'] != device.device_id:
            return Response({'detail': 'device_id mismatch.'}, status=400)

        try:
            employee = Employee.objects.get(
                employee_number=d['employee_number'], is_active=True
            )
        except Employee.DoesNotExist:
            return Response({'detail': f"Employee {d['employee_number']} not found."}, status=404)

        ts       = d['timestamp']
        rec_date = ts.date()
        rec_time = ts.time()
        event    = d['event_type']

        with transaction.atomic():
            rec, _ = AttendanceRecord.objects.get_or_create(
                employee=employee,
                date=rec_date,
                defaults={'source': 'biometric', 'biometric_device': device},
            )
            if event == 'in' and (rec.time_in is None or rec_time < rec.time_in):
                rec.time_in = rec_time
            elif event == 'out' and (rec.time_out is None or rec_time > rec.time_out):
                rec.time_out = rec_time
            rec.biometric_device = device
            rec.source = 'biometric'
            rec.compute_status()
            rec.save()

            device.last_sync = datetime.now()
            device.records_count = AttendanceRecord.objects.filter(
                biometric_device=device
            ).count()
            device.save(update_fields=['last_sync', 'records_count'])

        return Response({
            'status': 'recorded',
            'attendance_id': str(rec.id),
            'employee': employee.full_name,
            'date': str(rec_date),
            'time_in': str(rec.time_in) if rec.time_in else None,
        })


# ── Attendance ─────────────────────────────────────────────────────────────────

class AttendanceListView(generics.ListAPIView):
    serializer_class   = AttendanceRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = AttendanceRecord.objects.select_related('employee', 'biometric_device')
        params = self.request.query_params
        if d := params.get('date'):
            qs = qs.filter(date=d)
        if emp := params.get('employee'):
            qs = qs.filter(employee_id=emp)
        if src := params.get('source'):
            qs = qs.filter(source=src)
        return qs.order_by('-date', 'employee__last_name')


class DailySheetView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        day = request.query_params.get('date', str(date.today()))
        try:
            day = date.fromisoformat(day)
        except ValueError:
            return Response({'detail': 'Invalid date.'}, status=400)

        employees = Employee.objects.filter(is_active=True).select_related('department')
        records   = {
            r.employee_id: r
            for r in AttendanceRecord.objects.filter(date=day).select_related(
                'employee', 'biometric_device'
            )
        }

        sheet = []
        for emp in employees:
            rec = records.get(emp.id)
            sheet.append({
                'employee_id':     str(emp.id),
                'employee_number': emp.employee_number,
                'full_name':       emp.full_name,
                'employment_type': emp.employment_type,
                'status':          rec.status if rec else 'absent',
                'time_in':         rec.time_in if rec else None,
                'time_out':        rec.time_out if rec else None,
                'late_minutes':    rec.late_minutes if rec else 0,
                'source':          rec.source if rec else None,
            })
        return Response(sheet)


class MonthlyReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        year  = int(request.query_params.get('year',  date.today().year))
        month = int(request.query_params.get('month', date.today().month))
        qs    = AttendanceRecord.objects.filter(
            date__year=year, date__month=month
        ).select_related('employee')

        summary = {}
        for r in qs:
            k = r.employee_id
            if k not in summary:
                emp = r.employee
                summary[k] = {
                    'employee_id': str(k),
                    'employee_number': emp.employee_number,
                    'full_name': emp.full_name,
                    'employment_type': emp.employment_type,
                    'present': 0, 'absent': 0, 'late': 0,
                    'half_day': 0, 'on_leave': 0, 'days_worked': 0,
                }
            s = r.status
            if s in summary[k]:
                summary[k][s] += 1
            if s in ('present', 'late', 'half_day'):
                summary[k]['days_worked'] += 1
        return Response(list(summary.values()))


class BulkMarkAttendanceView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = BulkAttendanceSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)

        updated = 0
        for item in ser.validated_data['records']:
            rec, _ = AttendanceRecord.objects.get_or_create(
                employee_id=item['employee'],
                date=item['date'],
                defaults={'source': 'manual'},
            )
            rec.status = item['status']
            rec.source = 'manual'
            if 'time_in' in item:
                rec.time_in = item['time_in']
            if 'time_out' in item:
                rec.time_out = item['time_out']
            rec.save()
            updated += 1
        return Response({'updated': updated})


# ── Leave ──────────────────────────────────────────────────────────────────────

class LeaveTypeListCreateView(generics.ListCreateAPIView):
    queryset           = LeaveType.objects.all()
    serializer_class   = LeaveTypeSerializer
    permission_classes = [IsAuthenticated]


class LeaveTypeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = LeaveType.objects.all()
    serializer_class   = LeaveTypeSerializer
    permission_classes = [IsAuthenticated]


class LeaveBalanceListView(generics.ListCreateAPIView):
    serializer_class   = LeaveBalanceSerializer
    permission_classes = [IsAuthenticated]
    pagination_class   = None  # always filtered by year, return all matching records

    def get_queryset(self):
        qs = LeaveBalance.objects.select_related('employee', 'leave_type').order_by(
            'employee__last_name', 'employee__first_name', 'leave_type__name'
        )
        if emp := self.request.query_params.get('employee'):
            qs = qs.filter(employee_id=emp)
        if yr := self.request.query_params.get('year'):
            qs = qs.filter(year=yr)
        return qs


class LeaveBalanceDetailView(generics.RetrieveUpdateAPIView):
    queryset           = LeaveBalance.objects.select_related('employee', 'leave_type')
    serializer_class   = LeaveBalanceSerializer
    permission_classes = [IsAuthenticated]


class LeaveBalanceInitializeView(APIView):
    """Bulk-create leave balances for all active employees for a given year.
    Carries forward remaining days from the previous year when the leave type allows it.
    Existing balances are not overwritten."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        year = int(request.data.get('year', datetime.now().year))
        employees   = Employee.objects.filter(is_active=True)
        leave_types = LeaveType.objects.filter(is_active=True)
        created_count = 0

        for emp in employees:
            for lt in leave_types:
                carried = Decimal('0')
                if lt.carry_forward:
                    try:
                        prev = LeaveBalance.objects.get(employee=emp, leave_type=lt, year=year - 1)
                        remaining = prev.entitled_days + prev.carried_forward - prev.taken_days
                        carried = min(max(remaining, Decimal('0')), Decimal(str(lt.max_carry_forward)))
                    except LeaveBalance.DoesNotExist:
                        pass

                _, created = LeaveBalance.objects.get_or_create(
                    employee=emp,
                    leave_type=lt,
                    year=year,
                    defaults={
                        'entitled_days':   lt.days_entitled,
                        'carried_forward': carried,
                        'taken_days':      Decimal('0'),
                    },
                )
                if created:
                    created_count += 1

        return Response({'created': created_count, 'year': year})


class LeaveApplicationListCreateView(generics.ListCreateAPIView):
    serializer_class   = LeaveApplicationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = LeaveApplication.objects.select_related('employee', 'leave_type')
        params = self.request.query_params
        if emp := params.get('employee'):
            qs = qs.filter(employee_id=emp)
        if st := params.get('status'):
            qs = qs.filter(status=st)
        return qs.order_by('-applied_at')


class LeaveApplicationDetailView(generics.RetrieveUpdateAPIView):
    queryset           = LeaveApplication.objects.select_related('employee', 'leave_type')
    serializer_class   = LeaveApplicationSerializer
    permission_classes = [IsAuthenticated]


class LeaveSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            app = LeaveApplication.objects.get(pk=pk)
        except LeaveApplication.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        if app.status != 'draft':
            return Response({'detail': 'Can only submit draft applications.'}, status=400)
        app.status = 'submitted'
        app.save(update_fields=['status'])
        return Response(LeaveApplicationSerializer(app).data)


class LeaveReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            app = LeaveApplication.objects.get(pk=pk)
        except LeaveApplication.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        ser = LeaveReviewSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        if app.status != 'submitted':
            return Response({'detail': 'Can only review submitted applications.'}, status=400)

        action = ser.validated_data['action']
        app.status       = action
        app.reviewed_by  = request.user
        app.reviewed_at  = datetime.now()
        app.review_notes = ser.validated_data.get('review_notes', '')
        app.save()

        if action == 'approved':
            balance, _ = LeaveBalance.objects.get_or_create(
                employee=app.employee,
                leave_type=app.leave_type,
                year=app.start_date.year,
                defaults={'entitled_days': app.leave_type.days_entitled},
            )
            available = float(balance.entitled_days) + float(balance.carried_forward) - float(balance.taken_days)
            if float(app.days) > available:
                return Response(
                    {'detail': f'Insufficient leave balance. Available: {available:.1f} days, requested: {float(app.days):.1f} days.'},
                    status=400,
                )
            balance.taken_days += app.days
            balance.save(update_fields=['taken_days'])

        return Response(LeaveApplicationSerializer(app).data)


# ── Payroll ────────────────────────────────────────────────────────────────────

class PayrollPeriodListCreateView(generics.ListCreateAPIView):
    queryset           = PayrollPeriod.objects.all()
    serializer_class   = PayrollPeriodSerializer
    permission_classes = [IsAuthenticated]


class PayrollPeriodDetailView(generics.RetrieveUpdateAPIView):
    queryset           = PayrollPeriod.objects.all()
    serializer_class   = PayrollPeriodSerializer
    permission_classes = [IsAuthenticated]


class GeneratePayrollView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            period = PayrollPeriod.objects.get(pk=pk)
        except PayrollPeriod.DoesNotExist:
            return Response({'detail': 'Period not found.'}, status=404)
        if period.status != 'draft':
            return Response({'detail': 'Can only generate for draft periods.'}, status=400)

        employees = Employee.objects.filter(is_active=True)
        created   = 0
        for emp in employees:
            entry, was_new = PayrollEntry.objects.get_or_create(
                period=period, employee=emp,
                defaults={
                    'basic_salary':        emp.basic_salary,
                    'house_allowance':     emp.house_allowance,
                    'transport_allowance': emp.transport_allowance,
                    'medical_allowance':   emp.medical_allowance,
                    'other_allowances':    emp.other_allowances,
                    'daily_rate':          emp.daily_rate,
                    'days_worked':         0,
                }
            )
            if was_new:
                entry.recalculate()
                created += 1

        period.status = 'processing'
        period.save(update_fields=['status'])
        return Response({'created': created, 'total': employees.count()})


class PayrollEntryListView(generics.ListAPIView):
    serializer_class   = PayrollEntrySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = PayrollEntry.objects.select_related('employee', 'period')
        if p := self.request.query_params.get('period'):
            qs = qs.filter(period_id=p)
        if emp := self.request.query_params.get('employee'):
            qs = qs.filter(employee_id=emp)
        return qs.order_by('employee__last_name')


class PayrollEntryDetailView(generics.RetrieveUpdateAPIView):
    queryset           = PayrollEntry.objects.select_related('employee', 'period')
    serializer_class   = PayrollEntrySerializer
    permission_classes = [IsAuthenticated]


class PayrollApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            period = PayrollPeriod.objects.get(pk=pk)
        except PayrollPeriod.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        if period.status not in ('processing', 'draft'):
            return Response({'detail': 'Cannot approve.'}, status=400)
        period.status      = 'approved'
        period.approved_by = request.user
        period.approved_at = datetime.now()
        period.save()
        return Response(PayrollPeriodSerializer(period).data)


class PayrollPayView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            period = PayrollPeriod.objects.get(pk=pk)
        except PayrollPeriod.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        if period.status != 'approved':
            return Response({'detail': 'Must be approved before paying.'}, status=400)

        entries = list(PayrollEntry.objects.select_related(
            'employee', 'employee__department', 'project'
        ).filter(period=period))

        try:
            from finance.models import JournalEntry, JournalLine, Account

            def _account(code, name, atype='expense'):
                acc, _ = Account.objects.get_or_create(
                    code=code,
                    defaults={'name': name, 'account_type': atype, 'is_active': True},
                )
                return acc

            bank_acc      = _account('1100', 'Bank Account',            'asset')
            paye_acc      = _account('2100', 'PAYE Payable',            'liability')
            nssf_acc      = _account('2110', 'NSSF Payable',            'liability')
            nhif_acc      = _account('2120', 'SHA/SHIF Payable',     'liability')
            site_sal_acc  = _account('5100', 'Salaries & Wages — Site', 'expense')
            hq_sal_acc    = _account('5200', 'Salaries & Wages — Overhead', 'expense')

            with transaction.atomic():
                period.status = 'paid'
                period.save(update_fields=['status'])

                je = JournalEntry.objects.create(
                    entry_type=JournalEntry.EntryType.PAYROLL,
                    entry_date=date.today(),
                    description=f'Payroll — {period.get_month_display()} {period.year}',
                    created_by=request.user,
                    posted_by=request.user,
                    status=JournalEntry.Status.POSTED,
                )

                # Debit lines: group by cost centre (project or overhead)
                from collections import defaultdict
                project_totals  = defaultdict(lambda: {'gross': 0, 'project': None, 'name': ''})
                overhead_gross  = 0
                total_paye = total_nssf_emp = total_nhif_emp = 0
                total_nssf_er  = total_nhif_er = total_net = 0

                for e in entries:
                    total_paye      += float(e.paye)
                    total_nssf_emp  += float(e.nssf_employee)
                    total_nhif_emp  += float(e.nhif_employee)
                    total_nssf_er   += float(e.nssf_employer)
                    total_nhif_er   += float(e.nhif_employer)
                    total_net       += float(e.net_pay)

                    if e.project_id:
                        project_totals[str(e.project_id)]['gross']   += float(e.gross_pay) + float(e.nssf_employer) + float(e.nhif_employer)
                        project_totals[str(e.project_id)]['project']  = e.project
                        project_totals[str(e.project_id)]['name']     = e.project.project_name
                    else:
                        dept = e.employee.department.name if e.employee.department_id else 'Overhead'
                        overhead_gross += float(e.gross_pay) + float(e.nssf_employer) + float(e.nhif_employer)

                # Create debit lines per project
                for key, data in project_totals.items():
                    JournalLine.objects.create(
                        journal=je, account=site_sal_acc,
                        description=f'Payroll — {data["name"]}',
                        debit=round(data['gross'], 2), credit=0,
                        project=data['project'], cost_code=Account.CostCode.LABOUR,
                    )

                # Create debit line for HQ/overhead
                if overhead_gross > 0:
                    JournalLine.objects.create(
                        journal=je, account=hq_sal_acc,
                        description='Payroll — Head Office / Overhead',
                        debit=round(overhead_gross, 2), credit=0,
                    )

                # Credit lines: statutory deductions payable + net pay via bank
                total_employer_cost = total_nssf_er + total_nhif_er
                if total_paye > 0:
                    JournalLine.objects.create(journal=je, account=paye_acc,
                        description='PAYE payable', debit=0, credit=round(total_paye, 2))
                nssf_total = total_nssf_emp + total_nssf_er
                if nssf_total > 0:
                    JournalLine.objects.create(journal=je, account=nssf_acc,
                        description='NSSF payable (employee + employer)', debit=0, credit=round(nssf_total, 2))
                nhif_total = total_nhif_emp + total_nhif_er
                if nhif_total > 0:
                    JournalLine.objects.create(journal=je, account=nhif_acc,
                        description='SHA/SHIF payable (employee + employer)', debit=0, credit=round(nhif_total, 2))
                JournalLine.objects.create(
                    journal=je, account=bank_acc,
                    description='Net pay disbursement',
                    debit=0, credit=round(total_net, 2),
                )
        except Exception as exc:
            # Ensure period is marked paid even if GL fails
            PayrollPeriod.objects.filter(pk=pk).update(status='paid')

        return Response(PayrollPeriodSerializer(period).data)


class PayslipView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            entry = PayrollEntry.objects.select_related('employee', 'period').get(pk=pk)
        except PayrollEntry.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        return Response(PayrollEntrySerializer(entry).data)


# ── Salary Advances ────────────────────────────────────────────────────────────

class SalaryAdvanceListCreateView(generics.ListCreateAPIView):
    serializer_class   = SalaryAdvanceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = SalaryAdvance.objects.select_related('employee')
        if emp := self.request.query_params.get('employee'):
            qs = qs.filter(employee_id=emp)
        if st := self.request.query_params.get('status'):
            qs = qs.filter(status=st)
        return qs.order_by('-created_at')


class SalaryAdvanceDetailView(generics.RetrieveUpdateAPIView):
    queryset           = SalaryAdvance.objects.select_related('employee')
    serializer_class   = SalaryAdvanceSerializer
    permission_classes = [IsAuthenticated]


class AdvanceReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            adv = SalaryAdvance.objects.get(pk=pk)
        except SalaryAdvance.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        ser = AdvanceReviewSerializer(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=400)
        adv.status      = ser.validated_data['action']
        adv.approved_by = request.user
        adv.approved_at = datetime.now()
        adv.save()
        return Response(SalaryAdvanceSerializer(adv).data)


# ── Disciplinary ───────────────────────────────────────────────────────────────

class DisciplinaryListCreateView(generics.ListCreateAPIView):
    serializer_class   = DisciplinaryRecordSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = DisciplinaryRecord.objects.select_related('employee')
        if emp := self.request.query_params.get('employee'):
            qs = qs.filter(employee_id=emp)
        return qs.order_by('-incident_date')


class DisciplinaryDetailView(generics.RetrieveUpdateAPIView):
    queryset           = DisciplinaryRecord.objects.select_related('employee')
    serializer_class   = DisciplinaryRecordSerializer
    permission_classes = [IsAuthenticated]


# ── HR Dashboard ───────────────────────────────────────────────────────────────

class HRDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today_date  = date.today()
        in_30_days  = today_date + timedelta(days=30)

        total        = Employee.objects.filter(is_active=True).count()
        staff_count  = Employee.objects.filter(is_active=True, employment_type='staff').count()
        casual_count = Employee.objects.filter(is_active=True, employment_type='casual').count()
        expiring     = Employee.objects.filter(
            is_active=True,
            contract_end_date__gte=today_date,
            contract_end_date__lte=in_30_days,
        ).count()

        today_records = AttendanceRecord.objects.filter(date=today_date)
        present  = today_records.filter(status__in=['present', 'late']).count()
        absent   = today_records.filter(status='absent').count()
        late     = today_records.filter(status='late').count()
        on_leave = today_records.filter(status='on_leave').count()

        pending_leaves   = LeaveApplication.objects.filter(status='submitted').count()
        pending_advances = SalaryAdvance.objects.filter(status='pending').count()

        recent = (
            Employee.objects
            .filter(is_active=True)
            .select_related('department')
            .order_by('-date_hired')[:5]
        )
        recent_list = [
            {
                'id':              str(e.id),
                'employee_number': e.employee_number,
                'full_name':       e.full_name,
                'employment_type': e.employment_type,
                'department_name': e.department.name if e.department else None,
                'date_hired':      str(e.date_hired),
            }
            for e in recent
        ]

        return Response({
            'total_employees':            total,
            'total_staff':                staff_count,
            'total_casuals':              casual_count,
            'expiring_contracts_30_days': expiring,
            'present_today':              present,
            'absent_today':               absent,
            'late_today':                 late,
            'on_leave_today':             on_leave,
            'pending_leave_applications': pending_leaves,
            'pending_advances':           pending_advances,
            'recent_employees':           recent_list,
        })


# ── Employee Transfers ─────────────────────────────────────────────────────────

class EmployeeTransferListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = EmployeeTransfer.objects.select_related('employee', 'requested_by', 'reviewed_by')
        employee = self.request.query_params.get('employee')
        status   = self.request.query_params.get('status')
        if employee:
            qs = qs.filter(employee=employee)
        if status:
            qs = qs.filter(status=status)
        return qs

    def get_serializer_class(self):
        return EmployeeTransferCreateSerializer if self.request.method == 'POST' else EmployeeTransferSerializer


class EmployeeTransferDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = EmployeeTransfer.objects.select_related('employee', 'requested_by', 'reviewed_by')
    serializer_class   = EmployeeTransferSerializer
    permission_classes = [IsAuthenticated]


class TransferSubmitView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        transfer = get_object_or_404(EmployeeTransfer, pk=pk)
        if transfer.status != EmployeeTransfer.Status.DRAFT:
            return Response({'detail': 'Only draft transfers can be submitted.'}, status=400)
        transfer.status = EmployeeTransfer.Status.SUBMITTED
        transfer.save()
        return Response(EmployeeTransferSerializer(transfer).data)


class TransferReviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        transfer = get_object_or_404(EmployeeTransfer, pk=pk)
        if transfer.status != EmployeeTransfer.Status.SUBMITTED:
            return Response({'detail': 'Only submitted transfers can be reviewed.'}, status=400)
        serializer = TransferReviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from django.utils import timezone
        transfer.status       = serializer.validated_data['action']
        transfer.reviewed_by  = request.user
        transfer.reviewed_at  = timezone.now()
        transfer.review_notes = serializer.validated_data.get('review_notes', '')
        transfer.save()

        if transfer.status == EmployeeTransfer.Status.APPROVED:
            # Update employee notes for permanent transfers
            if transfer.transfer_type == EmployeeTransfer.TransferType.PERMANENT:
                emp = transfer.employee
                emp.notes = f'{emp.notes}\nTransferred to {transfer.to_location} on {transfer.start_date}.'.strip()
                emp.save()

            # Auto-create Finance ExpenseClaim if allowances are present
            if transfer.total_allowance > 0:
                try:
                    from finance.models import ExpenseClaim, ExpenseClaimItem, Account
                    claim = ExpenseClaim.objects.create(
                        title=f'Transfer Allowance — {transfer.employee.full_name} → {transfer.to_location}',
                        submitted_by=transfer.requested_by,
                        project=transfer.project,
                        status=ExpenseClaim.Status.SUBMITTED,
                        notes=(
                            f'Auto-generated on approval of transfer request.\n'
                            f'Employee: {transfer.employee.full_name} ({transfer.employee.employee_number})\n'
                            f'Transfer: {transfer.from_location} → {transfer.to_location}'
                        ),
                    )
                    if transfer.relocation_allowance > 0:
                        ExpenseClaimItem.objects.create(
                            claim=claim,
                            date=transfer.start_date,
                            description=f'Relocation allowance — {transfer.to_location}',
                            category=Account.CostCode.LABOUR,
                            amount=transfer.relocation_allowance,
                        )
                    if transfer.daily_allowance > 0 and transfer.daily_allowance_days > 0:
                        ExpenseClaimItem.objects.create(
                            claim=claim,
                            date=transfer.start_date,
                            description=f'Daily allowance — {transfer.daily_allowance_days} days @ KES {transfer.daily_allowance}/day',
                            category=Account.CostCode.LABOUR,
                            amount=transfer.daily_allowance * transfer.daily_allowance_days,
                        )
                    claim.recalculate()
                except Exception:
                    pass  # Finance integration is best-effort; don't fail the approval

        return Response(EmployeeTransferSerializer(transfer).data)


# ── Casuals Register ────────────────────────────────────────────────────────────

from django.utils import timezone
import io


class CasualListCreateView(generics.ListCreateAPIView):
    serializer_class   = CasualSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Casual.objects.select_related(
            'created_by', 'foreman_approved_by', 'hr_approved_by'
        ).prefetch_related('daily_logs')
        status = self.request.query_params.get('status')
        search = self.request.query_params.get('search')
        placement = self.request.query_params.get('placement')
        if status:
            qs = qs.filter(status=status)
        if placement:
            qs = qs.filter(placement__icontains=placement)
        if search:
            qs = qs.filter(
                Q(full_name__icontains=search) |
                Q(id_number__icontains=search) |
                Q(phone__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class CasualDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset           = Casual.objects.prefetch_related('daily_logs')
    serializer_class   = CasualSerializer
    permission_classes = [IsAuthenticated]


class CasualLookupView(APIView):
    """Return existing casual by ID number (for returning casual pre-fill)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        id_number = request.query_params.get('id_number', '').strip()
        if not id_number:
            return Response({'error': 'id_number required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            casual = Casual.objects.prefetch_related('daily_logs').get(id_number=id_number)
            return Response(CasualSerializer(casual).data)
        except Casual.DoesNotExist:
            return Response(None, status=status.HTTP_404_NOT_FOUND)


class CasualApproveView(APIView):
    """Foreman or HR approval step."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            casual = Casual.objects.get(pk=pk)
        except Casual.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)

        action = request.data.get('action')  # 'foreman_approve' | 'hr_approve' | 'cancel'
        now    = timezone.now()

        if action == 'foreman_approve':
            if casual.status != Casual.Status.PENDING:
                return Response({'error': 'Can only foreman-approve pending casuals'}, status=400)
            casual.status              = Casual.Status.FOREMAN_APPROVED
            casual.foreman_approved_by = request.user
            casual.foreman_approved_at = now
        elif action == 'hr_approve':
            if casual.status != Casual.Status.FOREMAN_APPROVED:
                return Response({'error': 'Foreman must approve first'}, status=400)
            casual.status          = Casual.Status.HR_APPROVED
            casual.hr_approved_by  = request.user
            casual.hr_approved_at  = now
        elif action == 'cancel':
            casual.status = Casual.Status.CANCELLED
        elif action == 'mark_paid':
            if casual.status != Casual.Status.HR_APPROVED:
                return Response({'error': 'HR must approve before marking paid'}, status=400)
            casual.status = Casual.Status.PAID
        else:
            return Response({'error': 'Invalid action'}, status=400)

        casual.save()
        return Response(CasualSerializer(casual).data)


class CasualDailyLogListCreateView(generics.ListCreateAPIView):
    serializer_class   = CasualDailyLogSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = CasualDailyLog.objects.select_related('casual', 'logged_by')
        casual_id  = self.request.query_params.get('casual')
        work_date  = self.request.query_params.get('work_date')
        if casual_id:
            qs = qs.filter(casual_id=casual_id)
        if work_date:
            qs = qs.filter(work_date=work_date)
        return qs

    def perform_create(self, serializer):
        serializer.save(logged_by=self.request.user)


class CasualImportView(APIView):
    """Import casuals from Excel (.xlsx). Columns: full_name, id_number, phone, placement, assignment, daily_rate"""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            import openpyxl
        except ImportError:
            return Response({'error': 'openpyxl not installed'}, status=500)

        file = request.FILES.get('file')
        if not file:
            return Response({'error': 'No file provided'}, status=400)

        try:
            wb = openpyxl.load_workbook(io.BytesIO(file.read()), read_only=True, data_only=True)
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
        except Exception as e:
            return Response({'error': f'Cannot read file: {e}'}, status=400)

        if not rows:
            return Response({'error': 'Empty file'}, status=400)

        headers = [str(h).strip().lower() if h else '' for h in rows[0]]
        required = {'full_name', 'id_number', 'phone', 'placement'}
        if not required.issubset(set(headers)):
            return Response({'error': f'Missing columns. Required: {required}'}, status=400)

        def col(row, name):
            idx = headers.index(name)
            return str(row[idx]).strip() if row[idx] is not None else ''

        created, updated, errors = [], [], []
        for i, row in enumerate(rows[1:], start=2):
            id_number = col(row, 'id_number')
            if not id_number:
                continue
            try:
                defaults = {
                    'full_name':  col(row, 'full_name'),
                    'phone':      col(row, 'phone'),
                    'placement':  col(row, 'placement'),
                    'assignment': col(row, 'assignment') if 'assignment' in headers else '',
                    'daily_rate': col(row, 'daily_rate') if 'daily_rate' in headers else 0,
                    'created_by': request.user,
                }
                casual, was_created = Casual.objects.update_or_create(
                    id_number=id_number, defaults=defaults
                )
                (created if was_created else updated).append(id_number)
            except Exception as e:
                errors.append({'row': i, 'error': str(e)})

        return Response({'created': len(created), 'updated': len(updated), 'errors': errors})
