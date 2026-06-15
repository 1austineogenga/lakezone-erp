from rest_framework import serializers
from .models import (Account, Invoice, InvoiceLine, Bill, BillLine, Payment,
                     ExpenseClaim, ExpenseClaimItem, RetentionRelease,
                     ProjectBudget, PaymentCertificate, PerformanceBond,
                     Timesheet, TimesheetLine, JournalEntry, JournalLine)


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
    items                   = ExpenseClaimItemSerializer(many=True, read_only=True)
    submitted_by_name       = serializers.CharField(source='submitted_by.get_full_name', read_only=True)
    project_name            = serializers.CharField(source='project.name', read_only=True)
    requisition_reference   = serializers.CharField(source='requisition.reference_number', read_only=True)

    class Meta:
        model  = ExpenseClaim
        fields = ['id', 'reference', 'title', 'status', 'submitted_by', 'submitted_by_name',
                  'project', 'project_name', 'total_amount', 'notes',
                  'requisition', 'requisition_reference',
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


class ProjectBudgetSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model  = ProjectBudget
        fields = ['id', 'project', 'project_name', 'cost_code', 'description',
                  'budgeted_amount', 'notes', 'created_at']
        read_only_fields = ['created_at']

    def create(self, validated_data):
        return ProjectBudget.objects.create(
            **validated_data,
            created_by=self.context['request'].user,
        )


class PaymentCertificateSerializer(serializers.ModelSerializer):
    project_name   = serializers.CharField(source='project.name',          read_only=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)

    class Meta:
        model  = PaymentCertificate
        fields = [
            'id', 'certificate_number', 'status',
            'invoice', 'invoice_number', 'project', 'project_name',
            'certified_by', 'certificate_date', 'period_from', 'period_to',
            'contract_value', 'work_done_to_date', 'previous_certified',
            'certified_amount', 'retention_held', 'net_payment_due',
            'notes', 'created_at',
        ]
        read_only_fields = ['certificate_number', 'certified_amount', 'net_payment_due']

    def create(self, validated_data):
        return PaymentCertificate.objects.create(
            **validated_data,
            created_by=self.context['request'].user,
        )


class PerformanceBondSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    days_to_expiry = serializers.SerializerMethodField()

    class Meta:
        model  = PerformanceBond
        fields = [
            'id', 'bond_type', 'reference', 'project', 'project_name',
            'issuing_bank', 'beneficiary', 'amount',
            'issue_date', 'expiry_date', 'status', 'days_to_expiry',
            'notes', 'created_at',
        ]
        read_only_fields = ['status', 'created_at']

    def get_days_to_expiry(self, obj):
        from datetime import date
        return (obj.expiry_date - date.today()).days

    def create(self, validated_data):
        return PerformanceBond.objects.create(
            **validated_data,
            created_by=self.context['request'].user,
        )


class TimesheetLineSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model  = TimesheetLine
        fields = ['id', 'work_date', 'project', 'project_name', 'cost_code',
                  'description', 'hours', 'hourly_rate', 'amount']
        read_only_fields = ['amount']


class TimesheetSerializer(serializers.ModelSerializer):
    lines              = TimesheetLineSerializer(many=True, read_only=True)
    employee_name      = serializers.CharField(source='employee.get_full_name', read_only=True)

    class Meta:
        model  = Timesheet
        fields = ['id', 'reference', 'employee', 'employee_name', 'week_start',
                  'status', 'total_amount', 'notes',
                  'reviewed_by', 'reviewed_at', 'lines', 'created_at']
        read_only_fields = ['reference', 'employee', 'total_amount', 'reviewed_by', 'reviewed_at']


class TimesheetCreateSerializer(serializers.ModelSerializer):
    lines = TimesheetLineSerializer(many=True)

    class Meta:
        model  = Timesheet
        fields = ['week_start', 'notes', 'lines']

    def create(self, validated_data):
        lines_data = validated_data.pop('lines')
        ts = Timesheet.objects.create(
            **validated_data,
            employee=self.context['request'].user,
        )
        for line in lines_data:
            TimesheetLine.objects.create(timesheet=ts, **line)
        ts.recalculate()
        return ts


class JournalLineSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source='account.name', read_only=True)
    account_code = serializers.CharField(source='account.code', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model  = JournalLine
        fields = ['id', 'account', 'account_code', 'account_name',
                  'description', 'debit', 'credit',
                  'project', 'project_name', 'cost_code']


class JournalEntrySerializer(serializers.ModelSerializer):
    lines           = JournalLineSerializer(many=True, read_only=True)
    created_by_name = serializers.CharField(source='created_by.get_full_name', read_only=True)
    posted_by_name  = serializers.CharField(source='posted_by.get_full_name',  read_only=True)
    total_debits    = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    total_credits   = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    is_balanced     = serializers.BooleanField(read_only=True)

    class Meta:
        model  = JournalEntry
        fields = [
            'id', 'reference', 'entry_type', 'status', 'entry_date', 'period',
            'description', 'project', 'is_reversing', 'reversal_of',
            'created_by', 'created_by_name', 'posted_by', 'posted_by_name', 'posted_at',
            'total_debits', 'total_credits', 'is_balanced',
            'lines', 'created_at',
        ]
        read_only_fields = ['reference', 'period', 'posted_by', 'posted_at',
                            'total_debits', 'total_credits', 'is_balanced']


class JournalEntryCreateSerializer(serializers.ModelSerializer):
    lines = JournalLineSerializer(many=True)

    class Meta:
        model  = JournalEntry
        fields = ['entry_type', 'entry_date', 'description', 'project', 'lines']

    def validate_lines(self, lines):
        if len(lines) < 2:
            raise serializers.ValidationError('A journal entry requires at least 2 lines.')
        total_debit  = sum(l.get('debit', 0) for l in lines)
        total_credit = sum(l.get('credit', 0) for l in lines)
        if abs(total_debit - total_credit) >= 0.01:
            raise serializers.ValidationError(
                f'Journal is not balanced: debits={total_debit}, credits={total_credit}')
        return lines

    def create(self, validated_data):
        lines_data = validated_data.pop('lines')
        entry = JournalEntry.objects.create(
            **validated_data,
            created_by=self.context['request'].user,
        )
        for line in lines_data:
            JournalLine.objects.create(journal=entry, **line)
        return entry
