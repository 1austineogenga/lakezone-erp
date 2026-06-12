from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.db.models import Sum, Count, Q
from django.utils import timezone
from .models import Account, Invoice, Bill, Payment
from .serializers import (
    AccountSerializer,
    InvoiceSerializer, InvoiceCreateSerializer,
    BillSerializer, BillCreateSerializer,
    PaymentSerializer,
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
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
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
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
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


class FinanceDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        today = timezone.now().date()

        ar = Invoice.objects.aggregate(
            total_billed   = Sum('total_amount'),
            total_received = Sum('amount_paid'),
            total_outstanding = Sum('balance_due'),
        )
        overdue_ar = Invoice.objects.filter(
            due_date__lt=today,
            status__in=[Invoice.Status.SENT, Invoice.Status.CERTIFIED,
                        Invoice.Status.PARTIAL, Invoice.Status.OVERDUE]
        ).aggregate(total=Sum('balance_due'))

        ap = Bill.objects.aggregate(
            total_billed = Sum('total_amount'),
            total_paid   = Sum('amount_paid'),
            total_outstanding = Sum('balance_due'),
        )
        overdue_ap = Bill.objects.filter(
            due_date__lt=today,
            status__in=[Bill.Status.APPROVED, Bill.Status.PARTIAL, Bill.Status.OVERDUE]
        ).aggregate(total=Sum('balance_due'))

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
            'recent_invoices': recent_invoices,
            'recent_bills':    recent_bills,
        })
