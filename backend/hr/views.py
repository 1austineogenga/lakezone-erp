from datetime import date, datetime, timedelta
from django.db import transaction
from django.db.models import Q
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from .models import (
    JobGrade, Position, Employee, EmployeeDocument,
    BiometricDevice, AttendanceRecord,
    LeaveType, LeaveBalance, LeaveApplication,
    PayrollPeriod, PayrollEntry, SalaryAdvance, DisciplinaryRecord,
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

class EmployeeListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

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


class LeaveBalanceListView(generics.ListAPIView):
    serializer_class   = LeaveBalanceSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = LeaveBalance.objects.select_related('employee', 'leave_type')
        if emp := self.request.query_params.get('employee'):
            qs = qs.filter(employee_id=emp)
        if yr := self.request.query_params.get('year'):
            qs = qs.filter(year=yr)
        return qs


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
        return qs.order_by('-created_at')


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

        entries   = PayrollEntry.objects.filter(period=period)
        total_net = sum(e.net_pay for e in entries)

        try:
            from finance.models import JournalEntry, JournalLine
            with transaction.atomic():
                period.status = 'paid'
                period.save(update_fields=['status'])
                je = JournalEntry.objects.create(
                    reference=f'PAY-{period.month:02d}-{period.year}',
                    date=date.today(),
                    description=f'Payroll payment — {period.get_month_display()} {period.year}',
                    created_by=request.user,
                    status='posted',
                )
                JournalLine.objects.create(
                    entry=je, account_name='Salaries & Wages Expense',
                    account_code='5100', debit=total_net, credit=0,
                )
                JournalLine.objects.create(
                    entry=je, account_name='Bank Account',
                    account_code='1100', debit=0, credit=total_net,
                )
        except Exception:
            period.status = 'paid'
            period.save(update_fields=['status'])

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
