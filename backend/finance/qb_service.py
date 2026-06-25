"""
QuickBooks Online REST API service.

Handles OAuth token refresh and CRUD operations for the QB sync.
QB API: https://quickbooks.api.intuit.com/v3/company/{realm_id}/
"""
import requests
from base64 import b64encode
from datetime import timedelta
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

QB_SCOPES = 'com.intuit.quickbooks.accounting'
QB_AUTH_URL    = 'https://appcenter.intuit.com/connect/oauth2'
QB_TOKEN_URL   = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
QB_REVOKE_URL  = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'

QB_API_BASE = {
    'sandbox':    'https://sandbox-quickbooks.api.intuit.com/v3/company',
    'production': 'https://quickbooks.api.intuit.com/v3/company',
}

# Lakezone account_type → QB AccountType
ACCOUNT_TYPE_MAP = {
    'asset':     ('Asset',     'OtherAsset'),
    'liability': ('Liability', 'OtherCurrentLiability'),
    'equity':    ('Equity',    'OpeningBalanceEquity'),
    'revenue':   ('Revenue',   'SalesOfProductIncome'),
    'expense':   ('Expense',   'SuppliesExpenses'),
}


class QBService:
    def __init__(self, config):
        self.config = config

    # ── OAuth helpers ──────────────────────────────────────────────────────────

    def get_auth_url(self, state=''):
        params = {
            'client_id':     self.config.client_id,
            'scope':         QB_SCOPES,
            'redirect_uri':  self.config.redirect_uri,
            'response_type': 'code',
            'state':         state,
        }
        from urllib.parse import urlencode
        return f'{QB_AUTH_URL}?{urlencode(params)}'

    def exchange_code(self, code, realm_id):
        """Exchange auth code for access/refresh tokens. Saves to config."""
        creds = b64encode(f'{self.config.client_id}:{self.config.client_secret}'.encode()).decode()
        resp = requests.post(QB_TOKEN_URL, headers={
            'Authorization': f'Basic {creds}',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        }, data={
            'grant_type':   'authorization_code',
            'code':         code,
            'redirect_uri': self.config.redirect_uri,
        }, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        self._save_tokens(data, realm_id)

    def refresh_access_token(self):
        """Refresh expired access token using refresh_token."""
        creds = b64encode(f'{self.config.client_id}:{self.config.client_secret}'.encode()).decode()
        resp = requests.post(QB_TOKEN_URL, headers={
            'Authorization': f'Basic {creds}',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
        }, data={
            'grant_type':    'refresh_token',
            'refresh_token': self.config.refresh_token,
        }, timeout=15)
        resp.raise_for_status()
        self._save_tokens(resp.json())

    def _save_tokens(self, data, realm_id=None):
        self.config.access_token  = data['access_token']
        self.config.refresh_token = data.get('refresh_token', self.config.refresh_token)
        expires_in = data.get('expires_in', 3600)
        self.config.token_expiry  = timezone.now() + timedelta(seconds=int(expires_in) - 60)
        if realm_id:
            self.config.realm_id = realm_id
        self.config.is_connected  = True
        self.config.save(update_fields=[
            'access_token','refresh_token','token_expiry','realm_id','is_connected','updated_at'
        ])

    def disconnect(self):
        try:
            creds = b64encode(f'{self.config.client_id}:{self.config.client_secret}'.encode()).decode()
            requests.post(QB_REVOKE_URL, headers={
                'Authorization': f'Basic {creds}',
                'Content-Type': 'application/x-www-form-urlencoded',
            }, data={'token': self.config.refresh_token}, timeout=10)
        except Exception:
            pass
        self.config.access_token  = ''
        self.config.refresh_token = ''
        self.config.realm_id      = ''
        self.config.is_connected  = False
        self.config.save()

    def _ensure_token(self):
        if self.config.token_expiry and timezone.now() >= self.config.token_expiry:
            self.refresh_access_token()

    def _headers(self):
        self._ensure_token()
        return {
            'Authorization': f'Bearer {self.config.access_token}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }

    def _api_url(self, path):
        base = QB_API_BASE.get(self.config.environment, QB_API_BASE['sandbox'])
        return f'{base}/{self.config.realm_id}/{path}'

    def _get(self, path, params=None):
        r = requests.get(self._api_url(path), headers=self._headers(), params=params, timeout=20)
        r.raise_for_status()
        return r.json()

    def _post(self, path, payload):
        r = requests.post(self._api_url(path), headers=self._headers(), json=payload, timeout=20)
        r.raise_for_status()
        return r.json()

    def query(self, sql):
        r = requests.get(self._api_url('query'), headers=self._headers(),
                         params={'query': sql, 'minorversion': 65}, timeout=20)
        r.raise_for_status()
        return r.json()

    # ── Accounts ───────────────────────────────────────────────────────────────

    def sync_accounts(self):
        """Push Lakezone chart of accounts to QB."""
        from .models import Account
        ok, fail, errors = 0, 0, []
        for acct in Account.objects.filter(is_active=True):
            at, ast = ACCOUNT_TYPE_MAP.get(acct.account_type, ('Expense', 'SuppliesExpenses'))
            payload = {
                'Name':            acct.name[:100],
                'AcctNum':         acct.code,
                'AccountType':     at,
                'AccountSubType':  ast,
                'Description':     acct.description or '',
            }
            try:
                q = self.query(f"SELECT * FROM Account WHERE AcctNum = '{acct.code}'")
                existing = q.get('QueryResponse', {}).get('Account', [])
                if existing:
                    payload['Id']        = existing[0]['Id']
                    payload['SyncToken'] = existing[0]['SyncToken']
                    self._post('account?operation=update&minorversion=65', payload)
                else:
                    self._post('account?minorversion=65', payload)
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'{acct.code}: {e}')
        return ok, fail, errors

    # ── Customers (Clients) ────────────────────────────────────────────────────

    def sync_customers(self):
        """Push CRM clients to QB as Customers."""
        from crm.models import Client
        ok, fail, errors = 0, 0, []
        for client in Client.objects.filter(is_active=True):
            payload = {
                'DisplayName': client.company_name[:100],
                'CompanyName': client.company_name[:100],
                'PrimaryEmailAddr': {'Address': client.email or ''},
                'PrimaryPhone':     {'FreeFormNumber': client.phone or ''},
            }
            try:
                q = self.query(f"SELECT * FROM Customer WHERE DisplayName = '{client.company_name[:100].replace(chr(39), chr(39)+chr(39))}'")
                existing = q.get('QueryResponse', {}).get('Customer', [])
                if existing:
                    payload['Id']        = existing[0]['Id']
                    payload['SyncToken'] = existing[0]['SyncToken']
                    self._post('customer?operation=update&minorversion=65', payload)
                else:
                    self._post('customer?minorversion=65', payload)
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'{client.company_name}: {e}')
        return ok, fail, errors

    # ── Vendors (Suppliers) ────────────────────────────────────────────────────

    def sync_vendors(self):
        """Push procurement suppliers to QB as Vendors."""
        from procurement.models import Supplier
        ok, fail, errors = 0, 0, []
        for sup in Supplier.objects.filter(status='active'):
            payload = {
                'DisplayName':      sup.company_name[:100],
                'CompanyName':      sup.company_name[:100],
                'PrimaryEmailAddr': {'Address': sup.email or ''},
                'PrimaryPhone':     {'FreeFormNumber': sup.phone or ''},
                'TaxIdentifier':    sup.kra_pin or '',
            }
            try:
                q = self.query(f"SELECT * FROM Vendor WHERE DisplayName = '{sup.company_name[:100].replace(chr(39), chr(39)+chr(39))}'")
                existing = q.get('QueryResponse', {}).get('Vendor', [])
                if existing:
                    payload['Id']        = existing[0]['Id']
                    payload['SyncToken'] = existing[0]['SyncToken']
                    self._post('vendor?operation=update&minorversion=65', payload)
                else:
                    self._post('vendor?minorversion=65', payload)
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'{sup.company_name}: {e}')
        return ok, fail, errors

    # ── Invoices ───────────────────────────────────────────────────────────────

    def sync_invoices(self):
        """Push Lakezone invoices (non-draft) to QB."""
        from .models import Invoice
        ok, fail, errors = 0, 0, []

        # Build customer ID map from QB
        cust_map = {}
        try:
            q = self.query('SELECT Id, DisplayName FROM Customer MAXRESULTS 1000')
            for c in q.get('QueryResponse', {}).get('Customer', []):
                cust_map[c['DisplayName'].lower()] = c['Id']
        except Exception:
            pass

        for inv in Invoice.objects.exclude(status='draft').select_related('client','project'):
            lines = [
                {
                    'Amount': float(line.amount),
                    'DetailType': 'SalesItemLineDetail',
                    'Description': line.description,
                    'SalesItemLineDetail': {
                        'Qty': float(line.quantity),
                        'UnitPrice': float(line.unit_price),
                    }
                }
                for line in inv.lines.all()
            ]
            if not lines:
                continue

            client_name = inv.client.company_name.lower() if inv.client else ''
            cust_id = cust_map.get(client_name)
            if not cust_id:
                errors.append(f'Invoice {inv.invoice_number}: customer "{inv.client.company_name}" not in QB — sync customers first')
                fail += 1
                continue

            payload = {
                'DocNumber':    inv.invoice_number,
                'TxnDate':      str(inv.issue_date),
                'DueDate':      str(inv.due_date) if inv.due_date else str(inv.issue_date),
                'CustomerRef':  {'value': cust_id},
                'Line':         lines,
            }
            if inv.project:
                payload['CustomerMemo'] = {'value': inv.project.name[:1000]}

            try:
                q = self.query(f"SELECT * FROM Invoice WHERE DocNumber = '{inv.invoice_number}'")
                existing = q.get('QueryResponse', {}).get('Invoice', [])
                if existing:
                    payload['Id']        = existing[0]['Id']
                    payload['SyncToken'] = existing[0]['SyncToken']
                    self._post('invoice?operation=update&minorversion=65', payload)
                else:
                    self._post('invoice?minorversion=65', payload)
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'{inv.invoice_number}: {e}')
        return ok, fail, errors

    # ── Bills ──────────────────────────────────────────────────────────────────

    def sync_bills(self):
        """Push Lakezone bills (approved/paid) to QB."""
        from .models import Bill
        ok, fail, errors = 0, 0, []

        vendor_map = {}
        try:
            q = self.query('SELECT Id, DisplayName FROM Vendor MAXRESULTS 1000')
            for v in q.get('QueryResponse', {}).get('Vendor', []):
                vendor_map[v['DisplayName'].lower()] = v['Id']
        except Exception:
            pass

        for bill in Bill.objects.filter(status__in=['approved','partial','paid']).select_related('supplier','project'):
            lines = [
                {
                    'Amount': float(line.amount),
                    'DetailType': 'AccountBasedExpenseLineDetail',
                    'Description': line.description,
                    'AccountBasedExpenseLineDetail': {
                        'AccountRef': {'value': '1'},
                    }
                }
                for line in bill.lines.all()
            ]
            if not lines:
                continue

            vendor_name = bill.supplier.company_name.lower() if bill.supplier else ''
            vendor_id = vendor_map.get(vendor_name)
            if not vendor_id:
                errors.append(f'Bill {bill.bill_number}: vendor "{bill.supplier.company_name}" not in QB — sync vendors first')
                fail += 1
                continue

            payload = {
                'DocNumber':  bill.bill_number,
                'TxnDate':    str(bill.issue_date),
                'DueDate':    str(bill.due_date) if bill.due_date else str(bill.issue_date),
                'VendorRef':  {'value': vendor_id},
                'Line':       lines,
            }
            try:
                q = self.query(f"SELECT * FROM Bill WHERE DocNumber = '{bill.bill_number}'")
                existing = q.get('QueryResponse', {}).get('Bill', [])
                if existing:
                    payload['Id']        = existing[0]['Id']
                    payload['SyncToken'] = existing[0]['SyncToken']
                    self._post('bill?operation=update&minorversion=65', payload)
                else:
                    self._post('bill?minorversion=65', payload)
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'{bill.bill_number}: {e}')
        return ok, fail, errors

    # ── Payments ───────────────────────────────────────────────────────────────

    def sync_payments(self):
        """Push Lakezone receipt payments to QB."""
        from .models import Payment
        ok, fail, errors = 0, 0, []

        cust_map = {}
        try:
            q = self.query('SELECT Id, DisplayName FROM Customer MAXRESULTS 1000')
            for c in q.get('QueryResponse', {}).get('Customer', []):
                cust_map[c['DisplayName'].lower()] = c['Id']
        except Exception:
            pass

        for pmt in Payment.objects.filter(payment_type='receipt').select_related('invoice__client'):
            if not pmt.invoice or not pmt.invoice.client:
                continue
            client_name = pmt.invoice.client.company_name.lower()
            cust_id = cust_map.get(client_name)
            if not cust_id:
                fail += 1
                errors.append(f'Payment {pmt.id}: customer not in QB')
                continue
            payload = {
                'TxnDate':     str(pmt.payment_date),
                'TotalAmt':    float(pmt.amount),
                'CustomerRef': {'value': cust_id},
                'PaymentMethodRef': {'value': '1'},
                'PrivateNote': pmt.reference or '',
            }
            try:
                self._post('payment?minorversion=65', payload)
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'Payment {str(pmt.id)[:8]}: {e}')
        return ok, fail, errors

    # ── PULL methods (QB → Lakezone) ──────────────────────────────────────────

    def pull_accounts(self):
        """Fetch QB Accounts and create/update Lakezone chart of accounts."""
        from .models import Account

        # QB AccountType → Lakezone account_type
        QB_TYPE_MAP = {
            'Asset':     'asset',
            'Bank':      'asset',
            'Other Asset': 'asset',
            'Other Current Asset': 'asset',
            'Fixed Asset': 'asset',
            'Accounts Receivable': 'asset',
            'Liability': 'liability',
            'Credit Card': 'liability',
            'Long Term Liability': 'liability',
            'Other Current Liability': 'liability',
            'Accounts Payable': 'liability',
            'Equity':    'equity',
            'Revenue':   'revenue',
            'Income':    'revenue',
            'Other Income': 'revenue',
            'Expense':   'expense',
            'Other Expense': 'expense',
            'Cost of Goods Sold': 'expense',
        }

        ok, fail, errors = 0, 0, []
        try:
            resp = self.query('SELECT * FROM Account MAXRESULTS 1000')
            accounts = resp.get('QueryResponse', {}).get('Account', [])
        except Exception as e:
            return 0, 0, [f'Failed to fetch accounts from QB: {e}']

        for qb_acct in accounts:
            acct_num  = (qb_acct.get('AcctNum') or '').strip()
            name      = qb_acct.get('Name', '')[:255]
            qb_type   = qb_acct.get('AccountType', '')
            lz_type   = QB_TYPE_MAP.get(qb_type, 'expense')
            active    = qb_acct.get('Active', True)
            desc      = qb_acct.get('Description', '') or ''

            if not name:
                continue

            # Use AcctNum as code if available, else sanitise name
            code = acct_num if acct_num else name[:20].replace(' ', '_').upper()

            try:
                acct, created = Account.objects.update_or_create(
                    code=code,
                    defaults={
                        'name':         name,
                        'account_type': lz_type,
                        'description':  desc[:500],
                        'is_active':    active,
                    }
                )
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'{name}: {e}')

        return ok, fail, errors

    def pull_customers(self):
        """Fetch QB Customers and create/update CRM Clients."""
        from crm.models import Client

        ok, fail, errors = 0, 0, []
        try:
            resp = self.query('SELECT * FROM Customer MAXRESULTS 1000')
            customers = resp.get('QueryResponse', {}).get('Customer', [])
        except Exception as e:
            return 0, 0, [f'Failed to fetch customers from QB: {e}']

        for cust in customers:
            name    = (cust.get('DisplayName') or cust.get('CompanyName') or '').strip()
            email   = (cust.get('PrimaryEmailAddr') or {}).get('Address', '')
            phone   = (cust.get('PrimaryPhone') or {}).get('FreeFormNumber', '')
            active  = cust.get('Active', True)

            if not name:
                continue

            try:
                Client.objects.update_or_create(
                    company_name=name[:255],
                    defaults={
                        'email':     email[:254] if email else '',
                        'phone':     phone[:20]  if phone else '',
                        'is_active': active,
                    }
                )
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'{name}: {e}')

        return ok, fail, errors

    def pull_vendors(self):
        """Fetch QB Vendors and create/update Procurement Suppliers."""
        from procurement.models import Supplier

        ok, fail, errors = 0, 0, []
        try:
            resp = self.query('SELECT * FROM Vendor MAXRESULTS 1000')
            vendors = resp.get('QueryResponse', {}).get('Vendor', [])
        except Exception as e:
            return 0, 0, [f'Failed to fetch vendors from QB: {e}']

        for v in vendors:
            name    = (v.get('DisplayName') or v.get('CompanyName') or '').strip()
            email   = (v.get('PrimaryEmailAddr') or {}).get('Address', '')
            phone   = (v.get('PrimaryPhone') or {}).get('FreeFormNumber', '')
            kra_pin = (v.get('TaxIdentifier') or '').strip()
            active  = v.get('Active', True)

            if not name:
                continue

            try:
                Supplier.objects.update_or_create(
                    company_name=name[:255],
                    defaults={
                        'email':          email[:254]  if email   else '',
                        'phone':          phone[:20]   if phone   else '',
                        'kra_pin':        kra_pin[:20] if kra_pin else '',
                        'contact_person': name[:255],
                        'status':         'active' if active else 'pending',
                    }
                )
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'{name}: {e}')

        return ok, fail, errors

    def pull_invoices(self):
        """Fetch QB Invoices and create/update Lakezone Invoices."""
        from .models import Invoice, InvoiceLine
        from crm.models import Client
        from decimal import Decimal, InvalidOperation

        ok, fail, errors = 0, 0, []
        try:
            resp = self.query('SELECT * FROM Invoice MAXRESULTS 1000')
            invoices = resp.get('QueryResponse', {}).get('Invoice', [])
        except Exception as e:
            return 0, 0, [f'Failed to fetch invoices from QB: {e}']

        # Build customer name → Client map
        client_map = {c.company_name.lower(): c for c in Client.objects.all()}

        for qb_inv in invoices:
            doc_num    = (qb_inv.get('DocNumber') or '').strip()
            txn_date   = qb_inv.get('TxnDate', '')
            due_date   = qb_inv.get('DueDate', txn_date)
            total      = qb_inv.get('TotalAmt', 0)
            balance    = qb_inv.get('Balance', 0)
            cust_name  = (qb_inv.get('CustomerRef') or {}).get('name', '').lower()

            if not doc_num:
                continue

            client = client_map.get(cust_name)

            # Determine status
            try:
                bal = Decimal(str(balance))
                tot = Decimal(str(total))
            except InvalidOperation:
                bal, tot = Decimal('0'), Decimal('0')

            if bal == 0 and tot > 0:
                status = 'paid'
            elif bal < tot:
                status = 'partial'
            else:
                status = 'sent'

            try:
                inv, created = Invoice.objects.update_or_create(
                    invoice_number=doc_num,
                    defaults={
                        'client':       client,
                        'issue_date':   txn_date   or '2000-01-01',
                        'due_date':     due_date   or txn_date or '2000-01-01',
                        'subtotal':     total,
                        'total_amount': total,
                        'amount_paid':  Decimal(str(total)) - bal,
                        'balance_due':  bal,
                        'status':       status,
                        'invoice_type': 'other',
                    }
                )

                # Sync line items
                if created:
                    for line in qb_inv.get('Line', []):
                        desc   = line.get('Description', '') or ''
                        amount = line.get('Amount', 0)
                        detail = line.get('SalesItemLineDetail', {})
                        qty    = detail.get('Qty', 1) or 1
                        price  = detail.get('UnitPrice', amount) or amount
                        if desc or amount:
                            InvoiceLine.objects.create(
                                invoice=inv,
                                description=desc[:255] or 'QB line item',
                                quantity=qty,
                                unit_price=price,
                                amount=amount,
                            )
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'Invoice {doc_num}: {e}')

        return ok, fail, errors

    def pull_bills(self):
        """Fetch QB Bills and create/update Lakezone Bills."""
        from .models import Bill, BillLine
        from procurement.models import Supplier
        from decimal import Decimal, InvalidOperation

        ok, fail, errors = 0, 0, []
        try:
            resp = self.query('SELECT * FROM Bill MAXRESULTS 1000')
            bills = resp.get('QueryResponse', {}).get('Bill', [])
        except Exception as e:
            return 0, 0, [f'Failed to fetch bills from QB: {e}']

        vendor_map = {s.company_name.lower(): s for s in Supplier.objects.all()}

        for qb_bill in bills:
            doc_num    = (qb_bill.get('DocNumber') or '').strip()
            txn_date   = qb_bill.get('TxnDate', '')
            due_date   = qb_bill.get('DueDate', txn_date)
            total      = qb_bill.get('TotalAmt', 0)
            balance    = qb_bill.get('Balance', 0)
            vend_name  = (qb_bill.get('VendorRef') or {}).get('name', '').lower()

            if not doc_num:
                continue

            supplier = vendor_map.get(vend_name)

            try:
                bal = Decimal(str(balance))
                tot = Decimal(str(total))
            except InvalidOperation:
                bal, tot = Decimal('0'), Decimal('0')

            if bal == 0 and tot > 0:
                status = 'paid'
            elif bal < tot:
                status = 'partial'
            else:
                status = 'approved'

            if not supplier:
                errors.append(f'Bill {doc_num}: vendor "{vend_name}" not in ERP — pull vendors first')
                fail += 1
                continue

            try:
                bill, created = Bill.objects.update_or_create(
                    bill_number=doc_num,
                    defaults={
                        'supplier':     supplier,
                        'issue_date':   txn_date or '2000-01-01',
                        'due_date':     due_date or txn_date or '2000-01-01',
                        'subtotal':     total,
                        'total_amount': total,
                        'amount_paid':  tot - bal,
                        'balance_due':  bal,
                        'status':       status,
                        'bill_type':    'supplier',
                    }
                )

                if created:
                    for line in qb_bill.get('Line', []):
                        desc   = line.get('Description', '') or ''
                        amount = line.get('Amount', 0)
                        detail = line.get('AccountBasedExpenseLineDetail', {})
                        if desc or amount:
                            BillLine.objects.create(
                                bill=bill,
                                description=desc[:255] or 'QB line item',
                                quantity=1,
                                unit_price=amount,
                                amount=amount,
                            )
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'Bill {doc_num}: {e}')

        return ok, fail, errors

    def pull_payments(self):
        """Fetch QB Payments (customer receipts) and create Lakezone Payment records."""
        from .models import Payment, Invoice
        from decimal import Decimal

        ok, fail, errors = 0, 0, []
        try:
            resp = self.query('SELECT * FROM Payment MAXRESULTS 1000')
            payments = resp.get('QueryResponse', {}).get('Payment', [])
        except Exception as e:
            return 0, 0, [f'Failed to fetch payments from QB: {e}']

        for qb_pmt in payments:
            ref       = str(qb_pmt.get('Id', ''))
            txn_date  = qb_pmt.get('TxnDate', '')
            amount    = qb_pmt.get('TotalAmt', 0)
            note      = (qb_pmt.get('PrivateNote') or '').strip()

            # Skip if already imported (reference matches QB Id)
            if Payment.objects.filter(reference=f'QB-{ref}').exists():
                ok += 1
                continue

            # Try to match to an invoice via linked transactions
            invoice = None
            for line in qb_pmt.get('Line', []):
                for linked in line.get('LinkedTxn', []):
                    if linked.get('TxnType') == 'Invoice':
                        txn_id = linked.get('TxnId', '')
                        # Look up invoice by a QB doc number stored as invoice_number
                        # (best effort — may not match if not previously pulled)
                        break

            try:
                Payment.objects.create(
                    payment_type='receipt',
                    payment_method='bank_transfer',
                    invoice=invoice,
                    amount=Decimal(str(amount)),
                    payment_date=txn_date or '2000-01-01',
                    reference=f'QB-{ref}',
                    notes=note or f'Imported from QuickBooks (ID {ref})',
                )
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'Payment QB-{ref}: {e}')

        return ok, fail, errors
