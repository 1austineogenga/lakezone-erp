from rest_framework import generics, permissions, status as drf_status
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Q
from django.utils import timezone
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
from .models import Account, Invoice, Bill, Payment, ExpenseClaim
from .serializers import (
    AccountSerializer,
    InvoiceSerializer, InvoiceCreateSerializer,
    BillSerializer, BillCreateSerializer,
    PaymentSerializer,
    ExpenseClaimSerializer, ExpenseClaimCreateSerializer, ExpenseReviewSerializer,
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
            'pending_expenses': pending_expenses['count'] or 0,
            'recent_invoices':  recent_invoices,
            'recent_bills':     recent_bills,
        })
