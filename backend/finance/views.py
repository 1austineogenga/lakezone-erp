from rest_framework import generics, permissions, status as drf_status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Q
from django.utils import timezone
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from .models import Account, Invoice, Bill, Payment, ExpenseClaim, RetentionRelease
from .serializers import (
    AccountSerializer,
    InvoiceSerializer, InvoiceCreateSerializer,
    BillSerializer, BillCreateSerializer,
    PaymentSerializer,
    ExpenseClaimSerializer, ExpenseClaimCreateSerializer, ExpenseReviewSerializer,
    RetentionReleaseSerializer, RetentionReleaseCreateSerializer,
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
