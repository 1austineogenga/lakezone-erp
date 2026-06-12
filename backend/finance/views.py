from rest_framework import generics, permissions, status as drf_status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Q
from django.utils import timezone
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from .models import (Account, Invoice, Bill, Payment, ExpenseClaim, RetentionRelease,
                     ProjectBudget, PaymentCertificate, PerformanceBond,
                     Timesheet, JournalEntry, JournalLine)
from .serializers import (
    AccountSerializer,
    InvoiceSerializer, InvoiceCreateSerializer,
    BillSerializer, BillCreateSerializer,
    PaymentSerializer,
    ExpenseClaimSerializer, ExpenseClaimCreateSerializer, ExpenseReviewSerializer,
    RetentionReleaseSerializer, RetentionReleaseCreateSerializer,
    ProjectBudgetSerializer, PaymentCertificateSerializer, PerformanceBondSerializer,
    TimesheetSerializer, TimesheetCreateSerializer,
    JournalEntrySerializer, JournalEntryCreateSerializer,
)


class AccountListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = AccountSerializer
    queryset           = Account.objects.filter(is_active=True)


class AccountDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = AccountSerializer
    queryset           = Account.objects.all()


class InvoiceListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return InvoiceCreateSerializer if self.request.method == 'POST' else InvoiceSerializer

    def get_queryset(self):
        qs = Invoice.objects.select_related('client', 'project').all()
        s = self.request.query_params.get('status')
        if s:
            qs = qs.filter(status=s)
        return qs


class InvoiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = InvoiceSerializer
    queryset           = Invoice.objects.all()


class BillListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return BillCreateSerializer if self.request.method == 'POST' else BillSerializer

    def get_queryset(self):
        qs = Bill.objects.select_related('supplier', 'project').all()
        s = self.request.query_params.get('status')
        if s:
            qs = qs.filter(status=s)
        return qs


class BillDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = BillSerializer
    queryset           = Bill.objects.all()


class PaymentListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = PaymentSerializer

    def get_queryset(self):
        qs = Payment.objects.all()
        invoice_id = self.request.query_params.get('invoice')
        bill_id    = self.request.query_params.get('bill')
        if invoice_id:
            qs = qs.filter(invoice=invoice_id)
        if bill_id:
            qs = qs.filter(bill=bill_id)
        return qs


# ── Expense Claims ─────────────────────────────────────────────────────────────

class ExpenseClaimListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return ExpenseClaimCreateSerializer if self.request.method == 'POST' else ExpenseClaimSerializer

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)
        privileged = {'finance_officer', 'finance_manager', 'managing_director', 'admin', 'superuser'}
        qs = ExpenseClaim.objects.select_related('submitted_by', 'project').all()
        if role not in privileged:
            qs = qs.filter(submitted_by=user)
        s = self.request.query_params.get('status')
        if s:
            qs = qs.filter(status=s)
        return qs


class ExpenseClaimDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = ExpenseClaimSerializer
    queryset           = ExpenseClaim.objects.all()


class ExpenseClaimSubmitView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            claim = ExpenseClaim.objects.get(pk=pk, submitted_by=request.user)
        except ExpenseClaim.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=drf_status.HTTP_404_NOT_FOUND)
        if claim.status != ExpenseClaim.Status.DRAFT:
            return Response({'detail': 'Already submitted.'}, status=drf_status.HTTP_400_BAD_REQUEST)
        claim.status = ExpenseClaim.Status.SUBMITTED
        claim.save(update_fields=['status'])
        return Response(ExpenseClaimSerializer(claim).data)


class ExpenseClaimReviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            claim = ExpenseClaim.objects.get(pk=pk)
        except ExpenseClaim.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=drf_status.HTTP_404_NOT_FOUND)
        ser = ExpenseReviewSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        claim.status      = ser.validated_data['action']
        claim.reviewed_by = request.user
        claim.reviewed_at = timezone.now()
        claim.review_notes = ser.validated_data.get('review_notes', '')
        claim.save(update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_notes'])
        return Response(ExpenseClaimSerializer(claim).data)


# ── Cash Flow View ─────────────────────────────────────────────────────────────

class CashFlowView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # Rolling 12 months
        today   = date.today()
        start   = today.replace(day=1) - relativedelta(months=11)
        months  = []
        cur     = start
        while cur <= today:
            months.append(cur)
            cur = cur + relativedelta(months=1)

        data = []
        for m in months:
            m_end = m + relativedelta(months=1) - timedelta(days=1)
            label = m.strftime('%b %Y')

            inflows = Payment.objects.filter(
                payment_type='receipt',
                payment_date__gte=m,
                payment_date__lte=m_end,
            ).aggregate(total=Sum('amount'))['total'] or 0

            outflows = Payment.objects.filter(
                payment_type='payment',
                payment_date__gte=m,
                payment_date__lte=m_end,
            ).aggregate(total=Sum('amount'))['total'] or 0

            # Upcoming (invoiced but not yet paid) for future months
            expected_inflows = Invoice.objects.filter(
                due_date__gte=m,
                due_date__lte=m_end,
                status__in=[Invoice.Status.SENT, Invoice.Status.CERTIFIED,
                            Invoice.Status.PARTIAL],
            ).aggregate(total=Sum('balance_due'))['total'] or 0

            expected_outflows = Bill.objects.filter(
                due_date__gte=m,
                due_date__lte=m_end,
                status__in=[Bill.Status.APPROVED, Bill.Status.PARTIAL],
            ).aggregate(total=Sum('balance_due'))['total'] or 0

            data.append({
                'month':             label,
                'inflows':           float(inflows),
                'outflows':          float(outflows),
                'net':               float(inflows) - float(outflows),
                'expected_inflows':  float(expected_inflows),
                'expected_outflows': float(expected_outflows),
            })

        return Response(data)


# ── Contract Profitability ─────────────────────────────────────────────────────

class ContractProfitabilityView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from projects.models import Project
        projects = Project.objects.all().order_by('-created_at')
        result = []
        for p in projects:
            invoiced = Invoice.objects.filter(project=p).aggregate(
                total=Sum('total_amount'))['total'] or 0
            received = Invoice.objects.filter(project=p).aggregate(
                total=Sum('amount_paid'))['total'] or 0
            costs = Bill.objects.filter(project=p).aggregate(
                total=Sum('total_amount'))['total'] or 0
            expenses = ExpenseClaim.objects.filter(
                project=p, status__in=['approved', 'paid']
            ).aggregate(total=Sum('total_amount'))['total'] or 0

            contract_value = float(p.contract_value or 0)
            gross_margin   = float(invoiced) - float(costs) - float(expenses)
            margin_pct     = (gross_margin / float(invoiced) * 100) if invoiced else 0

            result.append({
                'id':             str(p.id),
                'name':           p.name,
                'status':         p.status,
                'contract_value': contract_value,
                'invoiced':       float(invoiced),
                'received':       float(received),
                'costs':          float(costs) + float(expenses),
                'gross_margin':   gross_margin,
                'margin_pct':     round(margin_pct, 1),
            })

        return Response(result)


# ── Finance Dashboard ──────────────────────────────────────────────────────────

class FinanceDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()

        ar = Invoice.objects.aggregate(
            total_billed      = Sum('total_amount'),
            total_received    = Sum('amount_paid'),
            total_outstanding = Sum('balance_due'),
        )
        overdue_ar = Invoice.objects.filter(
            due_date__lt=today,
            status__in=[Invoice.Status.SENT, Invoice.Status.CERTIFIED,
                        Invoice.Status.PARTIAL, Invoice.Status.OVERDUE]
        ).aggregate(total=Sum('balance_due'))

        ap = Bill.objects.aggregate(
            total_billed      = Sum('total_amount'),
            total_paid        = Sum('amount_paid'),
            total_outstanding = Sum('balance_due'),
        )
        overdue_ap = Bill.objects.filter(
            due_date__lt=today,
            status__in=[Bill.Status.APPROVED, Bill.Status.PARTIAL, Bill.Status.OVERDUE]
        ).aggregate(total=Sum('balance_due'))

        pending_expenses = ExpenseClaim.objects.filter(
            status=ExpenseClaim.Status.SUBMITTED
        ).aggregate(count=Sum('total_amount'))

        recent_invoices = InvoiceSerializer(
            Invoice.objects.select_related('client', 'project').order_by('-created_at')[:5],
            many=True
        ).data
        recent_bills = BillSerializer(
            Bill.objects.select_related('supplier', 'project').order_by('-created_at')[:5],
            many=True
        ).data

        retention_held = Invoice.objects.aggregate(
            total=Sum('retention_amount'))['total'] or 0
        retention_payable = Bill.objects.filter(
            bill_type=Bill.BillType.SUBCONTRACTOR
        ).aggregate(total=Sum('retention_amount') if hasattr(Bill, 'retention_amount') else Sum('withholding_tax'))['total'] or 0

        return Response({
            'ar': {
                'total_billed':      ar['total_billed'] or 0,
                'total_received':    ar['total_received'] or 0,
                'total_outstanding': ar['total_outstanding'] or 0,
                'overdue':           overdue_ar['total'] or 0,
            },
            'ap': {
                'total_billed':      ap['total_billed'] or 0,
                'total_paid':        ap['total_paid'] or 0,
                'total_outstanding': ap['total_outstanding'] or 0,
                'overdue':           overdue_ap['total'] or 0,
            },
            'pending_expenses':   pending_expenses['count'] or 0,
            'retention_held':     float(retention_held),
            'recent_invoices':    recent_invoices,
            'recent_bills':       recent_bills,
        })


# ── Retention Management ───────────────────────────────────────────────────────

class RetentionScheduleView(APIView):
    """Summary of all retention held (receivable) and owed (payable)."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        # AR retention — amounts held by clients on our invoices
        ar_retention = Invoice.objects.filter(
            retention_amount__gt=0
        ).select_related('client', 'project').values(
            'id', 'invoice_number', 'client__company_name',
            'project__name', 'issue_date', 'retention_amount',
        )

        # Released AR retention
        released_ar = RetentionRelease.objects.filter(
            retention_type='receivable'
        ).aggregate(total=Sum('amount'))['total'] or 0

        total_ar_held = Invoice.objects.aggregate(
            t=Sum('retention_amount'))['t'] or 0

        # AP retention — amounts we are holding from subcontractors (on bills)
        # We track this via RetentionRelease payable records recorded manually
        ap_retention = RetentionRelease.objects.filter(
            retention_type='payable'
        ).select_related('bill', 'project')

        releases = RetentionRelease.objects.select_related(
            'invoice', 'bill', 'project', 'released_by'
        ).order_by('release_date')

        return Response({
            'summary': {
                'ar_retention_held':    float(total_ar_held),
                'ar_retention_released': float(released_ar),
                'ar_retention_net':     float(total_ar_held) - float(released_ar),
            },
            'ar_invoices': list(ar_retention),
            'releases':    RetentionReleaseSerializer(releases, many=True).data,
        })


class RetentionReleaseListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return RetentionReleaseCreateSerializer if self.request.method == 'POST' else RetentionReleaseSerializer

    def get_queryset(self):
        return RetentionRelease.objects.select_related(
            'invoice', 'bill', 'project', 'released_by'
        ).all()

    def perform_create(self, serializer):
        serializer.save()


class RetentionReleaseDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = RetentionReleaseSerializer
    queryset           = RetentionRelease.objects.all()


class RetentionMarkReleasedView(APIView):
    """Mark a retention release as released / paid."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            release = RetentionRelease.objects.get(pk=pk)
        except RetentionRelease.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=drf_status.HTTP_404_NOT_FOUND)

        new_status = request.data.get('status', 'released')
        if new_status not in ('released', 'paid'):
            return Response({'detail': 'status must be released or paid.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        release.status      = new_status
        release.released_by = request.user
        release.released_at = timezone.now()
        release.save(update_fields=['status', 'released_by', 'released_at'])
        return Response(RetentionReleaseSerializer(release).data)


# ── Aged Debtors / Creditors ───────────────────────────────────────────────────

def _age_band(days_overdue):
    if days_overdue <= 0:   return 'current'
    if days_overdue <= 30:  return '1_30'
    if days_overdue <= 60:  return '31_60'
    if days_overdue <= 90:  return '61_90'
    return '90_plus'


class AgedDebtorsView(APIView):
    """Aged debtors — outstanding AR invoices bucketed by how overdue they are."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = date.today()
        bands = {'current': 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0}
        rows  = []

        unpaid = Invoice.objects.filter(
            balance_due__gt=0,
            status__in=[Invoice.Status.SENT, Invoice.Status.CERTIFIED,
                        Invoice.Status.PARTIAL, Invoice.Status.OVERDUE, Invoice.Status.DISPUTED]
        ).select_related('client', 'project')

        client_totals = {}
        for inv in unpaid:
            days = (today - inv.due_date).days
            band = _age_band(days)
            bands[band] += float(inv.balance_due)
            key = str(inv.client_id)
            if key not in client_totals:
                client_totals[key] = {
                    'client_id':   key,
                    'client_name': inv.client.company_name,
                    'current': 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0,
                    'total': 0,
                }
            client_totals[key][band]  += float(inv.balance_due)
            client_totals[key]['total'] += float(inv.balance_due)

        return Response({
            'totals': bands,
            'grand_total': sum(bands.values()),
            'by_client': sorted(client_totals.values(), key=lambda x: -x['total']),
        })


class AgedCreditorsView(APIView):
    """Aged creditors — outstanding AP bills bucketed by how overdue they are."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = date.today()
        bands = {'current': 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0}

        unpaid = Bill.objects.filter(
            balance_due__gt=0,
            status__in=[Bill.Status.APPROVED, Bill.Status.PARTIAL,
                        Bill.Status.OVERDUE, Bill.Status.DISPUTED]
        ).select_related('supplier', 'project')

        supplier_totals = {}
        for bill in unpaid:
            days = (today - bill.due_date).days
            band = _age_band(days)
            bands[band] += float(bill.balance_due)
            key = str(bill.supplier_id)
            if key not in supplier_totals:
                supplier_totals[key] = {
                    'supplier_id':   key,
                    'supplier_name': bill.supplier.company_name,
                    'current': 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0,
                    'total': 0,
                }
            supplier_totals[key][band]    += float(bill.balance_due)
            supplier_totals[key]['total'] += float(bill.balance_due)

        return Response({
            'totals': bands,
            'grand_total': sum(bands.values()),
            'by_supplier': sorted(supplier_totals.values(), key=lambda x: -x['total']),
        })


# ── Budget vs Actual ───────────────────────────────────────────────────────────

class ProjectBudgetListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = ProjectBudgetSerializer

    def get_queryset(self):
        qs = ProjectBudget.objects.select_related('project').all()
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs


class ProjectBudgetDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = ProjectBudgetSerializer
    queryset           = ProjectBudget.objects.all()


class BudgetVsActualView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from .models import Account, BillLine, ExpenseClaimItem
        from django.db.models import Sum

        project_id = request.query_params.get('project')

        budget_qs = ProjectBudget.objects.select_related('project').all()
        if project_id:
            budget_qs = budget_qs.filter(project_id=project_id)

        # Actual costs = bill lines + approved expense items grouped by cost code
        bill_actuals = (
            BillLine.objects
            .filter(cost_code__isnull=False)
            .exclude(cost_code='')
        )
        if project_id:
            bill_actuals = bill_actuals.filter(bill__project_id=project_id)
        bill_actuals = (
            bill_actuals
            .values('cost_code', 'bill__project_id', 'bill__project__name')
            .annotate(actual=Sum('amount'))
        )

        expense_actuals = (
            ExpenseClaimItem.objects
            .filter(claim__status='approved')
        )
        if project_id:
            expense_actuals = expense_actuals.filter(claim__project_id=project_id)
        expense_actuals = (
            expense_actuals
            .values('category', 'claim__project_id', 'claim__project__name')
            .annotate(actual=Sum('amount'))
        )

        # Build lookup: (project_id, cost_code) -> actual amount
        actuals = {}
        for row in bill_actuals:
            k = (str(row['bill__project_id']), row['cost_code'])
            actuals[k] = actuals.get(k, 0) + float(row['actual'] or 0)
        for row in expense_actuals:
            k = (str(row['claim__project_id']), row['category'])
            actuals[k] = actuals.get(k, 0) + float(row['actual'] or 0)

        rows = []
        for b in budget_qs:
            k = (str(b.project_id), b.cost_code)
            actual = actuals.get(k, 0)
            budgeted = float(b.budgeted_amount)
            variance = budgeted - actual
            rows.append({
                'id': str(b.id),
                'project_id':   str(b.project_id),
                'project_name': b.project.name,
                'cost_code':    b.cost_code,
                'description':  b.description,
                'budgeted':     budgeted,
                'actual':       actual,
                'variance':     variance,
                'variance_pct': round((variance / budgeted * 100) if budgeted else 0, 1),
            })

        total_budgeted = sum(r['budgeted'] for r in rows)
        total_actual   = sum(r['actual']   for r in rows)

        return Response({
            'rows': rows,
            'totals': {
                'budgeted': total_budgeted,
                'actual':   total_actual,
                'variance': total_budgeted - total_actual,
            }
        })


# ── Tax & Compliance ───────────────────────────────────────────────────────────

class VATSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models.functions import TruncMonth

        output_vat = (
            Invoice.objects
            .exclude(status='cancelled')
            .annotate(month=TruncMonth('issue_date'))
            .values('month')
            .annotate(total=Sum('vat_amount'))
            .order_by('month')
        )
        input_vat = (
            Bill.objects
            .exclude(status='draft')
            .annotate(month=TruncMonth('issue_date'))
            .values('month')
            .annotate(total=Sum('vat_amount'))
            .order_by('month')
        )

        months = {}
        for row in output_vat:
            m = row['month'].strftime('%Y-%m') if row['month'] else 'unknown'
            months.setdefault(m, {'month': m, 'output_vat': 0, 'input_vat': 0})
            months[m]['output_vat'] = float(row['total'] or 0)
        for row in input_vat:
            m = row['month'].strftime('%Y-%m') if row['month'] else 'unknown'
            months.setdefault(m, {'month': m, 'output_vat': 0, 'input_vat': 0})
            months[m]['input_vat'] = float(row['total'] or 0)

        result = sorted(months.values(), key=lambda x: x['month'])
        for r in result:
            r['net_vat_payable'] = r['output_vat'] - r['input_vat']

        totals = {
            'output_vat': sum(r['output_vat'] for r in result),
            'input_vat':  sum(r['input_vat']  for r in result),
        }
        totals['net_vat_payable'] = totals['output_vat'] - totals['input_vat']

        return Response({'monthly': result, 'totals': totals})


class WHTRegisterView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        bills = (
            Bill.objects
            .filter(withholding_tax__gt=0)
            .select_related('supplier', 'project')
            .order_by('-issue_date')
        )
        supplier_id = request.query_params.get('supplier')
        if supplier_id:
            bills = bills.filter(supplier_id=supplier_id)

        rows = [
            {
                'bill_id':        str(b.id),
                'bill_number':    b.bill_number,
                'supplier_id':    str(b.supplier_id),
                'supplier_name':  b.supplier.company_name,
                'project_name':   b.project.name if b.project else None,
                'issue_date':     b.issue_date.isoformat(),
                'subtotal':       float(b.subtotal),
                'wht_amount':     float(b.withholding_tax),
                'wht_rate':       round(float(b.withholding_tax) / float(b.subtotal) * 100, 2) if b.subtotal else 0,
            }
            for b in bills
        ]

        supplier_totals = {}
        for r in rows:
            s = r['supplier_name']
            supplier_totals.setdefault(s, {'supplier_name': s, 'total_wht': 0, 'count': 0})
            supplier_totals[s]['total_wht'] += r['wht_amount']
            supplier_totals[s]['count']     += 1

        return Response({
            'entries':          rows,
            'by_supplier':      sorted(supplier_totals.values(), key=lambda x: -x['total_wht']),
            'total_wht':        sum(r['wht_amount'] for r in rows),
        })


# ── Payment Certificates ───────────────────────────────────────────────────────

class PaymentCertificateListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = PaymentCertificateSerializer

    def get_queryset(self):
        qs = PaymentCertificate.objects.select_related('project', 'invoice').all()
        project_id = self.request.query_params.get('project')
        if project_id:
            qs = qs.filter(project_id=project_id)
        return qs


class PaymentCertificateDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = PaymentCertificateSerializer
    queryset           = PaymentCertificate.objects.all()


# ── Performance Bonds ──────────────────────────────────────────────────────────

class PerformanceBondListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = PerformanceBondSerializer

    def get_queryset(self):
        qs = PerformanceBond.objects.select_related('project').all()
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return qs


class PerformanceBondDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = PerformanceBondSerializer
    queryset           = PerformanceBond.objects.all()


# ── Payroll / Timesheets ───────────────────────────────────────────────────────

class TimesheetListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return TimesheetCreateSerializer if self.request.method == 'POST' else TimesheetSerializer

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', None)
        privileged = {'finance_officer', 'finance_manager', 'managing_director', 'admin', 'superuser', 'hr_manager'}
        qs = Timesheet.objects.select_related('employee').prefetch_related('lines').all()
        if role not in privileged:
            qs = qs.filter(employee=user)
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        return qs


class TimesheetDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = TimesheetSerializer
    queryset           = Timesheet.objects.prefetch_related('lines').all()


class TimesheetSubmitView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            ts = Timesheet.objects.get(pk=pk, employee=request.user)
        except Timesheet.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=drf_status.HTTP_404_NOT_FOUND)
        if ts.status != Timesheet.Status.DRAFT:
            return Response({'detail': 'Already submitted.'}, status=drf_status.HTTP_400_BAD_REQUEST)
        ts.status = Timesheet.Status.SUBMITTED
        ts.save(update_fields=['status'])
        return Response(TimesheetSerializer(ts).data)


class TimesheetReviewView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            ts = Timesheet.objects.get(pk=pk)
        except Timesheet.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=drf_status.HTTP_404_NOT_FOUND)
        action = request.data.get('action')
        if action not in ('approved', 'rejected'):
            return Response({'detail': 'action must be approved or rejected.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        ts.status      = action
        ts.reviewed_by = request.user
        ts.reviewed_at = timezone.now()
        ts.save(update_fields=['status', 'reviewed_by', 'reviewed_at'])
        return Response(TimesheetSerializer(ts).data)


class PayrollSummaryView(APIView):
    """Aggregate approved timesheet cost by project + cost_code."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum
        from .models import TimesheetLine

        project_id = request.query_params.get('project')
        qs = TimesheetLine.objects.filter(timesheet__status='approved').select_related('project')
        if project_id:
            qs = qs.filter(project_id=project_id)

        rows = (
            qs.values('project_id', 'project__name', 'cost_code')
              .annotate(total_hours=Sum('hours'), total_amount=Sum('amount'))
              .order_by('project__name', 'cost_code')
        )

        result = [
            {
                'project_id':   str(r['project_id']),
                'project_name': r['project__name'],
                'cost_code':    r['cost_code'],
                'total_hours':  float(r['total_hours'] or 0),
                'total_amount': float(r['total_amount'] or 0),
            }
            for r in rows
        ]

        return Response({
            'rows':         result,
            'grand_total':  sum(r['total_amount'] for r in result),
            'total_hours':  sum(r['total_hours']  for r in result),
        })


# ── General Ledger Journal ─────────────────────────────────────────────────────

class JournalEntryListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return JournalEntryCreateSerializer if self.request.method == 'POST' else JournalEntrySerializer

    def get_queryset(self):
        qs = JournalEntry.objects.select_related('project', 'created_by').prefetch_related('lines__account').all()
        status  = self.request.query_params.get('status')
        period  = self.request.query_params.get('period')
        etype   = self.request.query_params.get('entry_type')
        project = self.request.query_params.get('project')
        if status:  qs = qs.filter(status=status)
        if period:  qs = qs.filter(period=period)
        if etype:   qs = qs.filter(entry_type=etype)
        if project: qs = qs.filter(project_id=project)
        return qs


class JournalEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class   = JournalEntrySerializer
    queryset           = JournalEntry.objects.prefetch_related('lines__account').all()


class JournalPostView(APIView):
    """Post a draft journal entry to the ledger."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            entry = JournalEntry.objects.prefetch_related('lines').get(pk=pk)
        except JournalEntry.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=drf_status.HTTP_404_NOT_FOUND)
        if entry.status != JournalEntry.Status.DRAFT:
            return Response({'detail': 'Only draft entries can be posted.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        if not entry.is_balanced:
            return Response({'detail': f'Journal is not balanced. Debits={entry.total_debits}, Credits={entry.total_credits}'},
                            status=drf_status.HTTP_400_BAD_REQUEST)
        entry.status    = JournalEntry.Status.POSTED
        entry.posted_by = request.user
        entry.posted_at = timezone.now()
        entry.save(update_fields=['status', 'posted_by', 'posted_at'])
        return Response(JournalEntrySerializer(entry).data)


class JournalReverseView(APIView):
    """Create a reversing entry for a posted journal."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            entry = JournalEntry.objects.prefetch_related('lines').get(pk=pk)
        except JournalEntry.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=drf_status.HTTP_404_NOT_FOUND)
        if entry.status != JournalEntry.Status.POSTED:
            return Response({'detail': 'Only posted entries can be reversed.'},
                            status=drf_status.HTTP_400_BAD_REQUEST)

        reversal = JournalEntry.objects.create(
            entry_type   = entry.entry_type,
            entry_date   = date.today(),
            description  = f'Reversal of {entry.reference}: {entry.description}',
            project      = entry.project,
            is_reversing = True,
            reversal_of  = entry,
            created_by   = request.user,
        )
        for line in entry.lines.all():
            JournalLine.objects.create(
                journal=reversal,
                account=line.account,
                description=line.description,
                debit=line.credit,   # swap
                credit=line.debit,   # swap
                project=line.project,
                cost_code=line.cost_code,
            )
        entry.status = JournalEntry.Status.REVERSED
        entry.save(update_fields=['status'])
        return Response(JournalEntrySerializer(reversal).data, status=drf_status.HTTP_201_CREATED)


class TrialBalanceView(APIView):
    """Trial balance: sum of debits and credits per account for a period."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from django.db.models import Sum
        from .models import JournalLine

        period = request.query_params.get('period')  # YYYY-MM
        qs = JournalLine.objects.filter(journal__status='posted').select_related('account')
        if period:
            qs = qs.filter(journal__period=period)

        rows = (
            qs.values('account__code', 'account__name', 'account__account_type')
              .annotate(total_debit=Sum('debit'), total_credit=Sum('credit'))
              .order_by('account__code')
        )

        result = []
        for r in rows:
            debit  = float(r['total_debit']  or 0)
            credit = float(r['total_credit'] or 0)
            result.append({
                'account_code': r['account__code'],
                'account_name': r['account__name'],
                'account_type': r['account__account_type'],
                'total_debit':  debit,
                'total_credit': credit,
                'balance':      debit - credit,
            })

        total_debits  = sum(r['total_debit']  for r in result)
        total_credits = sum(r['total_credit'] for r in result)

        return Response({
            'period':        period or 'all',
            'rows':          result,
            'total_debits':  total_debits,
            'total_credits': total_credits,
            'is_balanced':   abs(total_debits - total_credits) < 0.01,
        })
