from rest_framework import serializers
from .models import Account, Invoice, InvoiceLine, Bill, BillLine, Payment, ExpenseClaim, ExpenseClaimItem, RetentionRelease


class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Account
        fields = ['id', 'code', 'name', 'account_type', 'cost_code',
                  'parent', 'description', 'is_active']


class InvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model  = InvoiceLine
        fields = ['id', 'description', 'quantity', 'unit_price', 'amount', 'account']


class InvoiceSerializer(serializers.ModelSerializer):
    lines        = InvoiceLineSerializer(many=True, read_only=True)
    client_name  = serializers.CharField(source='client.company_name', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model  = Invoice
        fields = [
            'id', 'invoice_number', 'invoice_type', 'status',
            'client', 'client_name', 'project', 'project_name',
            'issue_date', 'due_date', 'period_from', 'period_to',
            'subtotal', 'vat_rate', 'vat_amount', 'retention_rate',
            'retention_amount', 'total_amount', 'amount_paid', 'balance_due',
            'notes', 'lines', 'created_at',
        ]
        read_only_fields = ['invoice_number', 'vat_amount', 'retention_amount',
                            'total_amount', 'amount_paid', 'balance_due']


class InvoiceCreateSerializer(serializers.ModelSerializer):
    lines = InvoiceLineSerializer(many=True)

    class Meta:
        model  = Invoice
        fields = ['invoice_type', 'client', 'project', 'due_date', 'period_from',
                  'period_to', 'vat_rate', 'retention_rate', 'notes', 'lines']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines')
        invoice = Invoice.objects.create(
            **validated_data,
            created_by=self.context['request'].user,
        )
        for line in lines_data:
            InvoiceLine.objects.create(invoice=invoice, **line)
        invoice.recalculate()
        return invoice


class BillLineSerializer(serializers.ModelSerializer):
    class Meta:
        model  = BillLine
        fields = ['id', 'description', 'quantity', 'unit_price', 'amount',
                  'account', 'cost_code']


class BillSerializer(serializers.ModelSerializer):
    lines         = BillLineSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    project_name  = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model  = Bill
        fields = [
            'id', 'bill_number', 'bill_type', 'status',
            'supplier', 'supplier_name', 'project', 'project_name',
            'purchase_order', 'issue_date', 'due_date', 'supplier_ref',
            'subtotal', 'vat_amount', 'withholding_tax', 'total_amount',
            'amount_paid', 'balance_due', 'notes', 'lines', 'created_at',
        ]
        read_only_fields = ['bill_number', 'subtotal', 'total_amount',
                            'amount_paid', 'balance_due']


class BillCreateSerializer(serializers.ModelSerializer):
    lines = BillLineSerializer(many=True)

    class Meta:
        model  = Bill
        fields = ['bill_type', 'supplier', 'project', 'purchase_order',
                  'issue_date', 'due_date', 'supplier_ref', 'vat_amount',
                  'withholding_tax', 'notes', 'lines']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines')
        bill = Bill.objects.create(
            **validated_data,
            created_by=self.context['request'].user,
        )
        for line in lines_data:
            BillLine.objects.create(bill=bill, **line)
        bill.recalculate()
        return bill


class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Payment
        fields = ['id', 'payment_type', 'payment_method', 'invoice', 'bill',
                  'amount', 'payment_date', 'reference', 'notes', 'created_at']
        read_only_fields = ['created_at']

    def create(self, validated_data):
        return Payment.objects.create(
            **validated_data,
            recorded_by=self.context['request'].user,
        )


class ExpenseClaimItemSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ExpenseClaimItem
        fields = ['id', 'date', 'description', 'category', 'amount', 'receipt_ref']


class ExpenseClaimSerializer(serializers.ModelSerializer):
    items              = ExpenseClaimItemSerializer(many=True, read_only=True)
    submitted_by_name  = serializers.CharField(source='submitted_by.get_full_name', read_only=True)
    project_name       = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model  = ExpenseClaim
        fields = ['id', 'reference', 'title', 'status', 'submitted_by', 'submitted_by_name',
                  'project', 'project_name', 'total_amount', 'notes',
                  'reviewed_by', 'reviewed_at', 'review_notes', 'items', 'created_at']
        read_only_fields = ['reference', 'submitted_by', 'total_amount',
                            'reviewed_by', 'reviewed_at']


class ExpenseClaimCreateSerializer(serializers.ModelSerializer):
    items = ExpenseClaimItemSerializer(many=True)

    class Meta:
        model  = ExpenseClaim
        fields = ['title', 'project', 'notes', 'items']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        claim = ExpenseClaim.objects.create(
            **validated_data,
            submitted_by=self.context['request'].user,
            status=ExpenseClaim.Status.DRAFT,
        )
        for item in items_data:
            ExpenseClaimItem.objects.create(claim=claim, **item)
        claim.recalculate()
        return claim


class ExpenseReviewSerializer(serializers.Serializer):
    action       = serializers.ChoiceField(choices=['approved', 'rejected'])
    review_notes = serializers.CharField(required=False, allow_blank=True)


class RetentionReleaseSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)
    bill_number    = serializers.CharField(source='bill.bill_number',       read_only=True)
    project_name   = serializers.CharField(source='project.name',           read_only=True)
    released_by_name = serializers.CharField(source='released_by.get_full_name', read_only=True)

    class Meta:
        model  = RetentionRelease
        fields = [
            'id', 'retention_type', 'status',
            'invoice', 'invoice_number', 'bill', 'bill_number',
            'project', 'project_name', 'amount', 'release_date',
            'notes', 'released_by', 'released_by_name', 'released_at', 'created_at',
        ]
        read_only_fields = ['released_by', 'released_at']


class RetentionReleaseCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = RetentionRelease
        fields = ['retention_type', 'invoice', 'bill', 'project',
                  'amount', 'release_date', 'notes']
