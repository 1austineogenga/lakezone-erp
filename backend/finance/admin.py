from django.contrib import admin
from .models import Account, Invoice, InvoiceLine, Bill, BillLine, Payment, ExpenseClaim, ExpenseClaimItem, RetentionRelease


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display  = ['code', 'name', 'account_type', 'cost_code', 'is_active']
    list_filter   = ['account_type', 'cost_code', 'is_active']
    search_fields = ['code', 'name']


class InvoiceLineInline(admin.TabularInline):
    model  = InvoiceLine
    extra  = 0
    fields = ['description', 'quantity', 'unit_price', 'amount', 'account']
    readonly_fields = ['amount']


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display  = ['invoice_number', 'invoice_type', 'client', 'project',
                     'status', 'total_amount', 'balance_due', 'due_date']
    list_filter   = ['status', 'invoice_type']
    search_fields = ['invoice_number']
    readonly_fields = ['invoice_number', 'vat_amount', 'retention_amount',
                       'total_amount', 'amount_paid', 'balance_due']
    inlines = [InvoiceLineInline]


class BillLineInline(admin.TabularInline):
    model  = BillLine
    extra  = 0
    fields = ['description', 'quantity', 'unit_price', 'amount', 'account', 'cost_code']
    readonly_fields = ['amount']


@admin.register(Bill)
class BillAdmin(admin.ModelAdmin):
    list_display  = ['bill_number', 'bill_type', 'supplier', 'project',
                     'status', 'total_amount', 'balance_due', 'due_date']
    list_filter   = ['status', 'bill_type']
    search_fields = ['bill_number', 'supplier_ref']
    readonly_fields = ['bill_number', 'subtotal', 'total_amount',
                       'amount_paid', 'balance_due']
    inlines = [BillLineInline]


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display  = ['payment_type', 'payment_method', 'amount',
                     'payment_date', 'reference', 'recorded_by']
    list_filter   = ['payment_type', 'payment_method']
    search_fields = ['reference']


class ExpenseClaimItemInline(admin.TabularInline):
    model  = ExpenseClaimItem
    extra  = 0
    fields = ['date', 'description', 'category', 'amount', 'receipt_ref']


@admin.register(ExpenseClaim)
class ExpenseClaimAdmin(admin.ModelAdmin):
    list_display  = ['reference', 'title', 'submitted_by', 'project',
                     'status', 'total_amount', 'created_at']
    list_filter   = ['status']
    search_fields = ['reference', 'title']
    readonly_fields = ['reference', 'total_amount', 'reviewed_by', 'reviewed_at']
    inlines = [ExpenseClaimItemInline]


@admin.register(RetentionRelease)
class RetentionReleaseAdmin(admin.ModelAdmin):
    list_display  = ['retention_type', 'project', 'amount', 'release_date', 'status', 'released_by']
    list_filter   = ['retention_type', 'status']
    readonly_fields = ['released_by', 'released_at']
