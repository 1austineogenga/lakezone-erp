from datetime import date
from django.test import TestCase
from django.contrib.auth import get_user_model

User = get_user_model()


def make_user(email="finance@test.com", role="finance_officer"):
    return User.objects.create_user(email=email, password="pass", role=role)


class InvoiceCreationAndLineItemTotalTest(TestCase):
    def setUp(self):
        from crm.models import Client
        self.user = make_user()
        self.client_obj = Client.objects.create(
            company_name="ACME Ltd",
            contact_person="John Doe",
            email="acme@test.com",
            phone="0700000000",
        )

    def test_invoice_line_items_sum_to_subtotal(self):
        from finance.models import Invoice, InvoiceLine
        inv = Invoice.objects.create(
            client=self.client_obj,
            due_date=date(2026, 12, 31),
            vat_rate=16,
            retention_rate=0,
            created_by=self.user,
        )
        InvoiceLine.objects.create(invoice=inv, description="Item A", quantity=2, unit_price=5000)
        InvoiceLine.objects.create(invoice=inv, description="Item B", quantity=3, unit_price=2000)
        inv.recalculate()
        inv.refresh_from_db()

        expected_subtotal = 2 * 5000 + 3 * 2000  # 16000
        self.assertEqual(float(inv.subtotal), expected_subtotal)

    def test_invoice_total_includes_vat_minus_retention(self):
        from finance.models import Invoice, InvoiceLine
        inv = Invoice.objects.create(
            client=self.client_obj,
            due_date=date(2026, 12, 31),
            vat_rate=16,
            retention_rate=5,
            created_by=self.user,
        )
        InvoiceLine.objects.create(invoice=inv, description="Work", quantity=1, unit_price=100000)
        inv.recalculate()
        inv.refresh_from_db()

        subtotal = 100000
        vat = subtotal * 16 / 100       # 16000
        retention = subtotal * 5 / 100  # 5000
        expected_total = subtotal + vat - retention  # 111000
        self.assertEqual(float(inv.total_amount), expected_total)


class JournalDebitCreditBalanceTest(TestCase):
    def setUp(self):
        from finance.models import Account
        self.user = make_user("journal@test.com")
        self.cash_account = Account.objects.create(
            code="1001", name="Cash", account_type="asset"
        )
        self.revenue_account = Account.objects.create(
            code="4001", name="Revenue", account_type="revenue"
        )

    def test_balanced_journal_is_balanced(self):
        from finance.models import JournalEntry, JournalLine
        je = JournalEntry.objects.create(
            entry_date=date(2026, 6, 1),
            description="Test balanced entry",
            created_by=self.user,
        )
        JournalLine.objects.create(journal=je, account=self.cash_account, debit=50000, credit=0)
        JournalLine.objects.create(journal=je, account=self.revenue_account, debit=0, credit=50000)
        self.assertTrue(je.is_balanced)

    def test_unbalanced_journal_is_not_balanced(self):
        from finance.models import JournalEntry, JournalLine
        je = JournalEntry.objects.create(
            entry_date=date(2026, 6, 1),
            description="Unbalanced entry",
            created_by=self.user,
        )
        JournalLine.objects.create(journal=je, account=self.cash_account, debit=50000, credit=0)
        JournalLine.objects.create(journal=je, account=self.revenue_account, debit=0, credit=30000)
        self.assertFalse(je.is_balanced)

    def test_total_debits_equal_total_credits_when_balanced(self):
        from finance.models import JournalEntry, JournalLine
        je = JournalEntry.objects.create(
            entry_date=date(2026, 6, 1),
            description="Balanced check",
            created_by=self.user,
        )
        JournalLine.objects.create(journal=je, account=self.cash_account, debit=75000, credit=0)
        JournalLine.objects.create(journal=je, account=self.revenue_account, debit=0, credit=75000)
        self.assertEqual(je.total_debits, je.total_credits)


class PaymentReducesInvoiceBalanceTest(TestCase):
    def setUp(self):
        from crm.models import Client
        self.user = make_user("pay@test.com")
        self.client_obj = Client.objects.create(
            company_name="PayCo", contact_person="Jane", email="pay@co.com", phone="0711111111"
        )

    def test_payment_reduces_invoice_balance_due(self):
        from finance.models import Invoice, InvoiceLine, Payment
        inv = Invoice.objects.create(
            client=self.client_obj,
            due_date=date(2026, 12, 31),
            vat_rate=0,
            retention_rate=0,
            created_by=self.user,
        )
        InvoiceLine.objects.create(invoice=inv, description="Service", quantity=1, unit_price=200000)
        inv.recalculate()
        inv.refresh_from_db()
        original_balance = float(inv.balance_due)

        payment = Payment.objects.create(
            payment_type=Payment.PaymentType.RECEIPT,
            payment_method=Payment.PaymentMethod.BANK_TRANSFER,
            invoice=inv,
            amount=80000,
            payment_date=date(2026, 7, 1),
            recorded_by=self.user,
        )
        inv.refresh_from_db()

        self.assertEqual(float(inv.amount_paid), 80000)
        self.assertEqual(float(inv.balance_due), original_balance - 80000)
        self.assertEqual(inv.status, Invoice.Status.PARTIAL)

    def test_full_payment_marks_invoice_paid(self):
        from finance.models import Invoice, InvoiceLine, Payment
        inv = Invoice.objects.create(
            client=self.client_obj,
            due_date=date(2026, 12, 31),
            vat_rate=0,
            retention_rate=0,
            created_by=self.user,
        )
        InvoiceLine.objects.create(invoice=inv, description="Full", quantity=1, unit_price=50000)
        inv.recalculate()
        inv.refresh_from_db()

        Payment.objects.create(
            payment_type=Payment.PaymentType.RECEIPT,
            payment_method=Payment.PaymentMethod.CASH,
            invoice=inv,
            amount=float(inv.total_amount),
            payment_date=date(2026, 7, 1),
            recorded_by=self.user,
        )
        inv.refresh_from_db()
        self.assertEqual(inv.status, Invoice.Status.PAID)
        self.assertLessEqual(float(inv.balance_due), 0)
