"""
QuickBooks Online REST API service.

Handles OAuth token refresh and CRUD operations for the QB sync.
QB API: https://quickbooks.api.intuit.com/v3/company/{realm_id}/
"""
import requests
from base64 import b64encode
from datetime import timedelta
from decimal import Decimal, InvalidOperation
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

QB_SCOPES   = 'com.intuit.quickbooks.accounting'
QB_AUTH_URL  = 'https://appcenter.intuit.com/connect/oauth2'
QB_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer'
QB_REVOKE_URL = 'https://developer.api.intuit.com/v2/oauth2/tokens/revoke'

QB_API_BASE = {
    'sandbox':    'https://sandbox-quickbooks.api.intuit.com/v3/company',
    'production': 'https://quickbooks.api.intuit.com/v3/company',
}

# Lakezone account_type → QB AccountType / AccountSubType
ACCOUNT_TYPE_MAP = {
    'asset':     ('Asset',     'OtherAsset'),
    'liability': ('Liability', 'OtherCurrentLiability'),
    'equity':    ('Equity',    'OpeningBalanceEquity'),
    'revenue':   ('Revenue',   'SalesOfProductIncome'),
    'expense':   ('Expense',   'SuppliesExpenses'),
}

# QB AccountType → Lakezone account_type
QB_TYPE_MAP = {
    'Asset':                   'asset',
    'Bank':                    'asset',
    'Other Asset':             'asset',
    'Other Current Asset':     'asset',
    'Fixed Asset':             'asset',
    'Accounts Receivable':     'asset',
    'Liability':               'liability',
    'Credit Card':             'liability',
    'Long Term Liability':     'liability',
    'Other Current Liability': 'liability',
    'Accounts Payable':        'liability',
    'Equity':                  'equity',
    'Revenue':                 'revenue',
    'Income':                  'revenue',
    'Other Income':            'revenue',
    'Expense':                 'expense',
    'Other Expense':           'expense',
    'Cost of Goods Sold':      'expense',
}

# QB AccountSubType keywords → Lakezone CostCode
QB_SUBTYPE_COST_CODE = {
    'labour':        'labour',
    'labor':         'labour',
    'plant':         'plant',
    'equipment':     'plant',
    'machinery':     'plant',
    'material':      'materials',
    'subcontract':   'subcontractor',
    'overhead':      'overhead',
    'prelim':        'preliminaries',
}

# QB payment method name → Lakezone payment_method
QB_PMETHOD_MAP = {
    'cash':          'cash',
    'cheque':        'cheque',
    'check':         'cheque',
    'mpesa':         'mpesa',
    'm-pesa':        'mpesa',
}


def _safe_decimal(val):
    try:
        return Decimal(str(val))
    except (InvalidOperation, TypeError):
        return Decimal('0')


def _safe_date(val, fallback='2000-01-01'):
    return val if val else fallback


class QBService:
    def __init__(self, config, user=None):
        self.config = config
        self.user = user  # used as created_by / recorded_by on pull-created records

    # ── OAuth helpers ──────────────────────────────────────────────────────────

    def get_auth_url(self, state=''):
        from urllib.parse import urlencode
        params = {
            'client_id':     self.config.client_id,
            'scope':         QB_SCOPES,
            'redirect_uri':  self.config.redirect_uri,
            'response_type': 'code',
            'state':         state,
        }
        return f'{QB_AUTH_URL}?{urlencode(params)}'

    def exchange_code(self, code, realm_id):
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
        self._save_tokens(resp.json(), realm_id)

    def refresh_access_token(self):
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
        self.config.token_expiry  = timezone.now() + timedelta(seconds=int(data.get('expires_in', 3600)) - 60)
        if realm_id:
            self.config.realm_id = realm_id
        self.config.is_connected = True
        self.config.save(update_fields=[
            'access_token', 'refresh_token', 'token_expiry', 'realm_id', 'is_connected', 'updated_at',
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

    def _esc(self, s):
        """Escape single quotes for QB query strings."""
        return str(s).replace("'", "\\'")

    # ── Push: Accounts ─────────────────────────────────────────────────────────

    def sync_accounts(self):
        from .models import Account
        ok, fail, errors = 0, 0, []
        for acct in Account.objects.filter(is_active=True):
            at, ast = ACCOUNT_TYPE_MAP.get(acct.account_type, ('Expense', 'SuppliesExpenses'))
            payload = {
                'Name':           acct.name[:100],
                'AcctNum':        acct.code,
                'AccountType':    at,
                'AccountSubType': ast,
                'Description':    acct.description or '',
            }
            try:
                q = self.query(f"SELECT * FROM Account WHERE AcctNum = '{self._esc(acct.code)}'")
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

    # ── Push: Customers (Clients) ──────────────────────────────────────────────

    def sync_customers(self):
        from crm.models import Client
        ok, fail, errors = 0, 0, []
        for client in Client.objects.filter(is_active=True):
            display = client.company_name[:100]
            payload = {
                'DisplayName':      display,
                'CompanyName':      display,
                'PrimaryEmailAddr': {'Address': client.email or ''},
                'PrimaryPhone':     {'FreeFormNumber': client.phone or ''},
            }
            try:
                q = self.query(f"SELECT * FROM Customer WHERE DisplayName = '{self._esc(display)}'")
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

    # ── Push: Vendors (Suppliers) ──────────────────────────────────────────────

    def sync_vendors(self):
        from procurement.models import Supplier
        ok, fail, errors = 0, 0, []
        for sup in Supplier.objects.filter(status='active'):
            display = sup.company_name[:100]
            payload = {
                'DisplayName':      display,
                'CompanyName':      display,
                'PrimaryEmailAddr': {'Address': sup.email or ''},
                'PrimaryPhone':     {'FreeFormNumber': sup.phone or ''},
                'TaxIdentifier':    sup.kra_pin or '',
            }
            try:
                q = self.query(f"SELECT * FROM Vendor WHERE DisplayName = '{self._esc(display)}'")
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

    # ── Push: Invoices ─────────────────────────────────────────────────────────

    def _get_or_create_service_item(self):
        """Return QB Item Id for a generic 'Services' line item."""
        try:
            q = self.query("SELECT * FROM Item WHERE Name = 'Services'")
            items = q.get('QueryResponse', {}).get('Item', [])
            if items:
                return items[0]['Id']
            # Find first income account to attach
            aq = self.query("SELECT * FROM Account WHERE AccountType = 'Revenue' MAXRESULTS 1")
            income = aq.get('QueryResponse', {}).get('Account', [])
            income_id = income[0]['Id'] if income else '1'
            resp = self._post('item?minorversion=65', {
                'Name': 'Services',
                'Type': 'Service',
                'IncomeAccountRef': {'value': income_id},
            })
            return resp.get('Item', {}).get('Id', '1')
        except Exception:
            return '1'

    def sync_invoices(self):
        from .models import Invoice
        ok, fail, errors = 0, 0, []

        cust_map = {}
        try:
            q = self.query('SELECT Id, DisplayName FROM Customer MAXRESULTS 1000')
            for c in q.get('QueryResponse', {}).get('Customer', []):
                cust_map[c['DisplayName'].lower()] = c['Id']
        except Exception:
            pass

        service_item_id = self._get_or_create_service_item()

        for inv in Invoice.objects.exclude(status='draft').select_related('client', 'project'):
            if not inv.client:
                continue

            client_key = inv.client.company_name.lower()
            cust_id = cust_map.get(client_key)
            if not cust_id:
                fail += 1
                errors.append(f'Invoice {inv.invoice_number}: customer "{inv.client.company_name}" not in QB — sync customers first')
                continue

            lines = []
            for line in inv.lines.all():
                lines.append({
                    'Amount': float(line.amount),
                    'DetailType': 'SalesItemLineDetail',
                    'Description': line.description,
                    'SalesItemLineDetail': {
                        'ItemRef':  {'value': service_item_id},
                        'Qty':      float(line.quantity),
                        'UnitPrice': float(line.unit_price),
                    },
                })
            if not lines:
                continue

            memo_parts = []
            if inv.project:
                memo_parts.append(f'Project: {inv.project.name}')
            if inv.invoice_type != 'other':
                memo_parts.append(f'Type: {inv.get_invoice_type_display()}')
            if inv.retention_amount:
                memo_parts.append(f'Retention: {inv.retention_amount}')
            if inv.vat_amount:
                memo_parts.append(f'VAT: {inv.vat_amount}')

            payload = {
                'DocNumber':   inv.invoice_number,
                'TxnDate':     str(inv.issue_date),
                'DueDate':     str(inv.due_date),
                'CustomerRef': {'value': cust_id},
                'Line':        lines,
            }
            if memo_parts:
                payload['CustomerMemo'] = {'value': ' | '.join(memo_parts)[:1000]}

            try:
                q = self.query(f"SELECT * FROM Invoice WHERE DocNumber = '{self._esc(inv.invoice_number)}'")
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

    # ── Push: Bills ────────────────────────────────────────────────────────────

    def sync_bills(self):
        from .models import Bill
        ok, fail, errors = 0, 0, []

        vendor_map = {}
        try:
            q = self.query('SELECT Id, DisplayName FROM Vendor MAXRESULTS 1000')
            for v in q.get('QueryResponse', {}).get('Vendor', []):
                vendor_map[v['DisplayName'].lower()] = v['Id']
        except Exception:
            pass

        # Build QB expense account map: name.lower() → Id
        acct_map = {}
        try:
            q = self.query("SELECT Id, Name FROM Account WHERE AccountType = 'Expense' MAXRESULTS 1000")
            for a in q.get('QueryResponse', {}).get('Account', []):
                acct_map[a['Name'].lower()] = a['Id']
            # Also grab first expense account as fallback
            q2 = self.query("SELECT Id FROM Account WHERE AccountType = 'Expense' MAXRESULTS 1")
            fallback_accts = q2.get('QueryResponse', {}).get('Account', [])
            fallback_acct_id = fallback_accts[0]['Id'] if fallback_accts else '1'
        except Exception:
            fallback_acct_id = '1'

        for bill in Bill.objects.filter(status__in=['approved', 'partial', 'paid']).select_related('supplier', 'project'):
            if not bill.supplier:
                continue

            vendor_id = vendor_map.get(bill.supplier.company_name.lower())
            if not vendor_id:
                fail += 1
                errors.append(f'Bill {bill.bill_number}: vendor "{bill.supplier.company_name}" not in QB — sync vendors first')
                continue

            lines = []
            for line in bill.lines.all():
                # Try to match line account to QB account
                acct_id = fallback_acct_id
                if line.account:
                    acct_id = acct_map.get(line.account.name.lower(), fallback_acct_id)
                lines.append({
                    'Amount': float(line.amount),
                    'DetailType': 'AccountBasedExpenseLineDetail',
                    'Description': line.description,
                    'AccountBasedExpenseLineDetail': {
                        'AccountRef': {'value': acct_id},
                    },
                })
            if not lines:
                continue

            payload = {
                'DocNumber': bill.bill_number,
                'TxnDate':   str(bill.issue_date),
                'DueDate':   str(bill.due_date),
                'VendorRef': {'value': vendor_id},
                'Line':      lines,
            }
            if bill.supplier_ref:
                payload['PrivateNote'] = f'Supplier Ref: {bill.supplier_ref}'

            try:
                q = self.query(f"SELECT * FROM Bill WHERE DocNumber = '{self._esc(bill.bill_number)}'")
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

    # ── Push: Payments ─────────────────────────────────────────────────────────

    def sync_payments(self):
        """Push both receipt (AR) and supplier (AP) payments to QB."""
        from .models import Payment
        ok, fail, errors = 0, 0, []

        cust_map = {}
        try:
            q = self.query('SELECT Id, DisplayName FROM Customer MAXRESULTS 1000')
            for c in q.get('QueryResponse', {}).get('Customer', []):
                cust_map[c['DisplayName'].lower()] = c['Id']
        except Exception:
            pass

        vendor_map = {}
        try:
            q = self.query('SELECT Id, DisplayName FROM Vendor MAXRESULTS 1000')
            for v in q.get('QueryResponse', {}).get('Vendor', []):
                vendor_map[v['DisplayName'].lower()] = v['Id']
        except Exception:
            pass

        # Find a default AP/AR account for bill payments
        try:
            aq = self.query("SELECT Id FROM Account WHERE AccountType = 'Accounts Payable' MAXRESULTS 1")
            ap_accts = aq.get('QueryResponse', {}).get('Account', [])
            ap_acct_id = ap_accts[0]['Id'] if ap_accts else '1'
        except Exception:
            ap_acct_id = '1'

        for pmt in Payment.objects.select_related('invoice__client', 'bill__supplier'):
            try:
                if pmt.payment_type == 'receipt' and pmt.invoice and pmt.invoice.client:
                    cust_id = cust_map.get(pmt.invoice.client.company_name.lower())
                    if not cust_id:
                        fail += 1
                        errors.append(f'Payment {str(pmt.id)[:8]}: customer not in QB')
                        continue
                    # Check if already pushed
                    existing_note = f'LZ-{str(pmt.id)[:8]}'
                    q = self.query(f"SELECT * FROM Payment WHERE PrivateNote LIKE '%{existing_note}%'")
                    if q.get('QueryResponse', {}).get('Payment'):
                        ok += 1
                        continue
                    self._post('payment?minorversion=65', {
                        'TxnDate':     str(pmt.payment_date),
                        'TotalAmt':    float(pmt.amount),
                        'CustomerRef': {'value': cust_id},
                        'PrivateNote': f'{pmt.reference or ""} | LZ-{str(pmt.id)[:8]}',
                    })
                    ok += 1

                elif pmt.payment_type == 'payment' and pmt.bill and pmt.bill.supplier:
                    vendor_id = vendor_map.get(pmt.bill.supplier.company_name.lower())
                    if not vendor_id:
                        fail += 1
                        errors.append(f'Payment {str(pmt.id)[:8]}: vendor not in QB')
                        continue
                    existing_note = f'LZ-{str(pmt.id)[:8]}'
                    q = self.query(f"SELECT * FROM BillPayment WHERE PrivateNote LIKE '%{existing_note}%'")
                    if q.get('QueryResponse', {}).get('BillPayment'):
                        ok += 1
                        continue
                    self._post('billpayment?minorversion=65', {
                        'TxnDate':   str(pmt.payment_date),
                        'TotalAmt':  float(pmt.amount),
                        'VendorRef': {'value': vendor_id},
                        'PayType':   'Check',
                        'CheckPayment': {'BankAccountRef': {'value': ap_acct_id}},
                        'PrivateNote': f'{pmt.reference or ""} | LZ-{str(pmt.id)[:8]}',
                    })
                    ok += 1
                else:
                    continue
            except Exception as e:
                fail += 1
                errors.append(f'Payment {str(pmt.id)[:8]}: {e}')
        return ok, fail, errors

    # ── Pull: Accounts (QB → Lakezone) ────────────────────────────────────────

    def pull_accounts(self):
        from .models import Account
        ok, fail, errors = 0, 0, []
        try:
            resp = self.query('SELECT * FROM Account MAXRESULTS 1000')
            accounts = resp.get('QueryResponse', {}).get('Account', [])
        except Exception as e:
            return 0, 0, [f'Failed to fetch accounts from QB: {e}']

        # Build parent map: QB Id → code (for hierarchical accounts)
        qb_id_to_code = {}

        for qb_acct in accounts:
            acct_num = (qb_acct.get('AcctNum') or '').strip()
            name     = qb_acct.get('Name', '')[:255]
            qb_type  = qb_acct.get('AccountType', '')
            qb_sub   = qb_acct.get('AccountSubType', '') or ''
            lz_type  = QB_TYPE_MAP.get(qb_type, 'expense')
            active   = qb_acct.get('Active', True)
            desc     = (qb_acct.get('Description') or '')[:500]
            qb_id    = qb_acct.get('Id', '')

            if not name:
                continue

            code = acct_num if acct_num else name[:20].replace(' ', '_').upper()
            qb_id_to_code[qb_id] = code

            # Derive cost_code from QB sub-type keywords
            sub_lower = qb_sub.lower()
            cost_code = 'other'
            for keyword, cc in QB_SUBTYPE_COST_CODE.items():
                if keyword in sub_lower:
                    cost_code = cc
                    break

            try:
                Account.objects.update_or_create(
                    code=code,
                    defaults={
                        'name':         name,
                        'account_type': lz_type,
                        'cost_code':    cost_code,
                        'description':  desc,
                        'is_active':    active,
                    },
                )
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'{name}: {e}')

        # Second pass: wire up parent FKs
        for qb_acct in accounts:
            parent_ref = qb_acct.get('ParentRef')
            if not parent_ref:
                continue
            child_code  = qb_id_to_code.get(qb_acct.get('Id', ''))
            parent_code = qb_id_to_code.get(parent_ref.get('value', ''))
            if child_code and parent_code:
                try:
                    child  = Account.objects.get(code=child_code)
                    parent = Account.objects.get(code=parent_code)
                    if child.parent_id != parent.pk:
                        child.parent = parent
                        child.save(update_fields=['parent'])
                except Exception:
                    pass

        return ok, fail, errors

    # ── Pull: Customers (QB → Lakezone CRM Clients) ───────────────────────────

    def pull_customers(self):
        from crm.models import Client
        ok, fail, errors = 0, 0, []
        try:
            resp = self.query('SELECT * FROM Customer MAXRESULTS 1000')
            customers = resp.get('QueryResponse', {}).get('Customer', [])
        except Exception as e:
            return 0, 0, [f'Failed to fetch customers from QB: {e}']

        for cust in customers:
            name    = (cust.get('DisplayName') or cust.get('CompanyName') or '').strip()
            email   = (cust.get('PrimaryEmailAddr') or {}).get('Address', '').strip()
            phone   = (cust.get('PrimaryPhone') or {}).get('FreeFormNumber', '').strip()
            contact = (cust.get('GivenName') or '') + ' ' + (cust.get('FamilyName') or '')
            contact = contact.strip() or name
            active  = cust.get('Active', True)
            qb_id   = str(cust.get('Id', ''))

            if not name:
                continue

            # Require valid email; generate placeholder if absent
            if not email or '@' not in email:
                email = f'qb-{qb_id}@imported.lakezone'

            # Require phone; use placeholder if absent
            if not phone:
                phone = 'N/A'

            try:
                # Prefer dedup by email (more stable than display name)
                if Client.objects.filter(email=email).exists():
                    Client.objects.filter(email=email).update(
                        company_name=name[:255],
                        phone=phone[:20],
                        contact_person=contact[:200],
                        is_active=active,
                    )
                else:
                    Client.objects.update_or_create(
                        company_name=name[:255],
                        defaults={
                            'email':          email[:254],
                            'phone':          phone[:20],
                            'contact_person': contact[:200],
                            'is_active':      active,
                        },
                    )
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'{name}: {e}')

        return ok, fail, errors

    # ── Pull: Vendors (QB → Lakezone Suppliers) ───────────────────────────────

    def pull_vendors(self):
        from procurement.models import Supplier
        ok, fail, errors = 0, 0, []
        try:
            resp = self.query('SELECT * FROM Vendor MAXRESULTS 1000')
            vendors = resp.get('QueryResponse', {}).get('Vendor', [])
        except Exception as e:
            return 0, 0, [f'Failed to fetch vendors from QB: {e}']

        for v in vendors:
            name    = (v.get('DisplayName') or v.get('CompanyName') or '').strip()
            email   = (v.get('PrimaryEmailAddr') or {}).get('Address', '').strip()
            phone   = (v.get('PrimaryPhone') or {}).get('FreeFormNumber', '').strip()
            kra_pin = (v.get('TaxIdentifier') or '').strip()
            contact = (v.get('GivenName') or '') + ' ' + (v.get('FamilyName') or '')
            contact = contact.strip() or name
            active  = v.get('Active', True)
            qb_id   = str(v.get('Id', ''))

            if not name:
                continue

            # kra_pin is unique+required — use QB TaxIdentifier or generate placeholder
            if not kra_pin:
                kra_pin = f'QB-{qb_id}'

            if not email or '@' not in email:
                email = f'qb-vendor-{qb_id}@imported.lakezone'

            if not phone:
                phone = 'N/A'

            try:
                Supplier.objects.update_or_create(
                    kra_pin=kra_pin[:20],
                    defaults={
                        'company_name':   name[:255],
                        'email':          email[:254],
                        'phone':          phone[:20],
                        'contact_person': contact[:200],
                        'status':         'active' if active else 'pending',
                    },
                )
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'{name}: {e}')

        return ok, fail, errors

    # ── Pull: Invoices (QB → Lakezone Invoices) ───────────────────────────────

    def pull_invoices(self):
        from .models import Invoice, InvoiceLine
        from crm.models import Client
        ok, fail, errors = 0, 0, []

        if not self.user:
            return 0, 0, ['pull_invoices requires a user context — trigger via the sync API']

        try:
            resp = self.query('SELECT * FROM Invoice MAXRESULTS 1000')
            invoices = resp.get('QueryResponse', {}).get('Invoice', [])
        except Exception as e:
            return 0, 0, [f'Failed to fetch invoices from QB: {e}']

        # Build client lookup: email → Client, company_name.lower() → Client
        client_by_email = {c.email.lower(): c for c in Client.objects.all() if c.email}
        client_by_name  = {c.company_name.lower(): c for c in Client.objects.all()}

        for qb_inv in invoices:
            doc_num   = (qb_inv.get('DocNumber') or '').strip()
            txn_date  = qb_inv.get('TxnDate', '')
            due_date  = qb_inv.get('DueDate', '') or txn_date
            total     = _safe_decimal(qb_inv.get('TotalAmt', 0))
            balance   = _safe_decimal(qb_inv.get('Balance', 0))
            cust_ref  = qb_inv.get('CustomerRef') or {}
            cust_name = cust_ref.get('name', '').lower()
            memo      = (qb_inv.get('CustomerMemo') or {}).get('value', '')

            if not doc_num:
                continue

            # Resolve client
            client = client_by_name.get(cust_name)

            # Skip if no client — an invoice without a client breaks the FK constraint
            if not client:
                fail += 1
                errors.append(f'Invoice {doc_num}: client "{cust_name}" not found — pull customers first')
                continue

            # Determine status from balance
            if total > 0 and balance == 0:
                status = 'paid'
            elif balance < total:
                status = 'partial'
            else:
                status = 'sent'

            # Parse invoice_type hint from memo (stored there during push)
            inv_type = 'other'
            for choice_val, choice_label in Invoice.InvoiceType.choices:
                if choice_label.lower() in memo.lower():
                    inv_type = choice_val
                    break

            try:
                inv, created = Invoice.objects.update_or_create(
                    invoice_number=doc_num,
                    defaults={
                        'client':        client,
                        'issue_date':    _safe_date(txn_date),
                        'due_date':      _safe_date(due_date, _safe_date(txn_date)),
                        'subtotal':      total,
                        'total_amount':  total,
                        'amount_paid':   total - balance,
                        'balance_due':   balance,
                        'status':        status,
                        'invoice_type':  inv_type,
                        'created_by':    self.user,
                        'notes':         memo or '',
                    },
                )

                # Sync lines: replace on every pull so updates are captured
                inv.lines.all().delete()
                for line in qb_inv.get('Line', []):
                    if line.get('DetailType') not in ('SalesItemLineDetail', 'DescriptionOnly'):
                        continue
                    desc   = (line.get('Description') or 'QB line item')[:255]
                    amount = _safe_decimal(line.get('Amount', 0))
                    detail = line.get('SalesItemLineDetail', {})
                    qty    = _safe_decimal(detail.get('Qty', 1) or 1)
                    price  = _safe_decimal(detail.get('UnitPrice') or (amount / qty if qty else amount))
                    if amount:
                        InvoiceLine.objects.create(
                            invoice=inv,
                            description=desc,
                            quantity=qty,
                            unit_price=price,
                            amount=amount,
                        )

                # Recalculate totals from lines
                inv.recalculate()
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'Invoice {doc_num}: {e}')

        return ok, fail, errors

    # ── Pull: Bills (QB → Lakezone Bills) ─────────────────────────────────────

    def pull_bills(self):
        from .models import Bill, BillLine, Account
        from procurement.models import Supplier
        ok, fail, errors = 0, 0, []

        if not self.user:
            return 0, 0, ['pull_bills requires a user context — trigger via the sync API']

        try:
            resp = self.query('SELECT * FROM Bill MAXRESULTS 1000')
            bills = resp.get('QueryResponse', {}).get('Bill', [])
        except Exception as e:
            return 0, 0, [f'Failed to fetch bills from QB: {e}']

        vendor_map  = {s.company_name.lower(): s for s in Supplier.objects.all()}
        account_map = {a.name.lower(): a for a in Account.objects.filter(is_active=True)}

        for qb_bill in bills:
            doc_num   = (qb_bill.get('DocNumber') or '').strip()
            txn_date  = qb_bill.get('TxnDate', '')
            due_date  = qb_bill.get('DueDate', '') or txn_date
            total     = _safe_decimal(qb_bill.get('TotalAmt', 0))
            balance   = _safe_decimal(qb_bill.get('Balance', 0))
            vend_ref  = qb_bill.get('VendorRef') or {}
            vend_name = vend_ref.get('name', '').lower()
            note      = (qb_bill.get('PrivateNote') or '').strip()

            if not doc_num:
                continue

            supplier = vendor_map.get(vend_name)
            if not supplier:
                fail += 1
                errors.append(f'Bill {doc_num}: vendor "{vend_name}" not found — pull vendors first')
                continue

            if total > 0 and balance == 0:
                status = 'paid'
            elif balance < total:
                status = 'partial'
            else:
                status = 'approved'

            try:
                bill, _ = Bill.objects.update_or_create(
                    bill_number=doc_num,
                    defaults={
                        'supplier':      supplier,
                        'issue_date':    _safe_date(txn_date),
                        'due_date':      _safe_date(due_date, _safe_date(txn_date)),
                        'subtotal':      total,
                        'total_amount':  total,
                        'amount_paid':   total - balance,
                        'balance_due':   balance,
                        'status':        status,
                        'bill_type':     'supplier',
                        'created_by':    self.user,
                        'notes':         note or '',
                    },
                )

                # Sync lines: replace on every pull
                bill.lines.all().delete()
                for line in qb_bill.get('Line', []):
                    if line.get('DetailType') not in ('AccountBasedExpenseLineDetail', 'DescriptionOnly'):
                        continue
                    desc   = (line.get('Description') or 'QB line item')[:255]
                    amount = _safe_decimal(line.get('Amount', 0))
                    if not amount:
                        continue
                    # Try to match account from QB AccountRef name
                    acct_detail  = line.get('AccountBasedExpenseLineDetail', {})
                    acct_ref     = acct_detail.get('AccountRef', {})
                    acct_name    = acct_ref.get('name', '').lower()
                    matched_acct = account_map.get(acct_name)

                    cost_code = 'other'
                    if matched_acct:
                        cost_code = matched_acct.cost_code or 'other'

                    BillLine.objects.create(
                        bill=bill,
                        description=desc,
                        quantity=Decimal('1'),
                        unit_price=amount,
                        amount=amount,
                        account=matched_acct,
                        cost_code=cost_code,
                    )

                bill.recalculate()
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'Bill {doc_num}: {e}')

        return ok, fail, errors

    # ── Pull: Payments (QB → Lakezone Payments) ───────────────────────────────

    def pull_payments(self):
        """
        Pull both customer Payments (AR receipts) and BillPayments (AP payments) from QB.
        Uses LinkedTxn to associate payments with the correct invoice or bill.
        """
        from .models import Payment, Invoice, Bill
        ok, fail, errors = 0, 0, []

        if not self.user:
            return 0, 0, ['pull_payments requires a user context — trigger via the sync API']

        # Build QB Invoice Id → DocNumber (to link payments to local invoices)
        qb_inv_id_to_doc = {}
        try:
            resp = self.query('SELECT Id, DocNumber FROM Invoice MAXRESULTS 1000')
            for qi in resp.get('QueryResponse', {}).get('Invoice', []):
                if qi.get('DocNumber'):
                    qb_inv_id_to_doc[qi['Id']] = qi['DocNumber']
        except Exception:
            pass

        # Build QB Bill Id → DocNumber
        qb_bill_id_to_doc = {}
        try:
            resp = self.query('SELECT Id, DocNumber FROM Bill MAXRESULTS 1000')
            for qb in resp.get('QueryResponse', {}).get('Bill', []):
                if qb.get('DocNumber'):
                    qb_bill_id_to_doc[qb['Id']] = qb['DocNumber']
        except Exception:
            pass

        inv_map  = {i.invoice_number: i for i in Invoice.objects.all()}
        bill_map = {b.bill_number:    b for b in Bill.objects.all()}

        # ── Customer Payments (AR receipts) ───────────────────────────────────
        try:
            resp = self.query('SELECT * FROM Payment MAXRESULTS 1000')
            payments = resp.get('QueryResponse', {}).get('Payment', [])
        except Exception as e:
            return 0, 0, [f'Failed to fetch QB Payments: {e}']

        for qb_pmt in payments:
            ref      = str(qb_pmt.get('Id', ''))
            lz_ref   = f'QB-{ref}'
            txn_date = qb_pmt.get('TxnDate', '')
            amount   = _safe_decimal(qb_pmt.get('TotalAmt', 0))
            note     = (qb_pmt.get('PrivateNote') or '').strip()
            meth_ref = (qb_pmt.get('PaymentMethodRef') or {}).get('name', '').lower()
            method   = QB_PMETHOD_MAP.get(meth_ref, 'bank_transfer')

            if Payment.objects.filter(reference=lz_ref).exists():
                ok += 1
                continue

            # Resolve linked invoice
            invoice = None
            for line in qb_pmt.get('Line', []):
                for linked in line.get('LinkedTxn', []):
                    if linked.get('TxnType') == 'Invoice':
                        doc_num = qb_inv_id_to_doc.get(linked.get('TxnId', ''))
                        if doc_num:
                            invoice = inv_map.get(doc_num)
                        break
                if invoice:
                    break

            try:
                Payment.objects.create(
                    payment_type='receipt',
                    payment_method=method,
                    invoice=invoice,
                    amount=amount,
                    payment_date=_safe_date(txn_date),
                    reference=lz_ref,
                    notes=note or f'Imported from QuickBooks Payment ID {ref}',
                    recorded_by=self.user,
                )
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'Payment QB-{ref}: {e}')

        # ── Bill Payments (AP payments to suppliers) ───────────────────────────
        try:
            resp = self.query('SELECT * FROM BillPayment MAXRESULTS 1000')
            bill_payments = resp.get('QueryResponse', {}).get('BillPayment', [])
        except Exception:
            bill_payments = []

        for qb_bp in bill_payments:
            ref      = str(qb_bp.get('Id', ''))
            lz_ref   = f'QBBP-{ref}'
            txn_date = qb_bp.get('TxnDate', '')
            amount   = _safe_decimal(qb_bp.get('TotalAmt', 0))
            note     = (qb_bp.get('PrivateNote') or '').strip()

            if Payment.objects.filter(reference=lz_ref).exists():
                ok += 1
                continue

            # Resolve linked bill
            bill = None
            for line in qb_bp.get('Line', []):
                for linked in line.get('LinkedTxn', []):
                    if linked.get('TxnType') == 'Bill':
                        doc_num = qb_bill_id_to_doc.get(linked.get('TxnId', ''))
                        if doc_num:
                            bill = bill_map.get(doc_num)
                        break
                if bill:
                    break

            try:
                Payment.objects.create(
                    payment_type='payment',
                    payment_method='bank_transfer',
                    bill=bill,
                    amount=amount,
                    payment_date=_safe_date(txn_date),
                    reference=lz_ref,
                    notes=note or f'Imported from QuickBooks BillPayment ID {ref}',
                    recorded_by=self.user,
                )
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'BillPayment QB-{ref}: {e}')

        return ok, fail, errors

    # ── Pull: Journal Entries (QB → Lakezone) ─────────────────────────────────

    def pull_journal_entries(self):
        from .models import JournalEntry, JournalLine, Account
        ok, fail, errors = 0, 0, []

        if not self.user:
            return 0, 0, ['pull_journal_entries requires a user context']

        try:
            resp = self.query('SELECT * FROM JournalEntry MAXRESULTS 1000')
            entries = resp.get('QueryResponse', {}).get('JournalEntry', [])
        except Exception as e:
            return 0, 0, [f'Failed to fetch journal entries from QB: {e}']

        account_map      = {a.name.lower(): a for a in Account.objects.filter(is_active=True)}
        account_code_map = {a.code: a for a in Account.objects.all()}

        for qb_je in entries:
            ref      = str(qb_je.get('Id', ''))
            doc_num  = (qb_je.get('DocNumber') or f'QB-JE-{ref}').strip()
            txn_date = qb_je.get('TxnDate', '')
            memo     = (qb_je.get('PrivateNote') or '').strip()

            if not ref:
                continue

            try:
                je, _ = JournalEntry.objects.update_or_create(
                    reference=doc_num[:30],
                    defaults={
                        'entry_date':  _safe_date(txn_date),
                        'entry_type':  'manual',
                        'description': memo[:500] or f'Imported from QuickBooks JE {ref}',
                        'status':      'posted',
                        'source':      'quickbooks',
                        'created_by':  self.user,
                    },
                )
                je.lines.all().delete()
                for line in qb_je.get('Line', []):
                    detail    = line.get('JournalEntryLineDetail', {})
                    posting   = detail.get('PostingType', 'Debit')
                    acct_ref  = detail.get('AccountRef', {})
                    acct_name = acct_ref.get('name', '').lower()
                    acct_num  = acct_ref.get('value', '')
                    amount    = _safe_decimal(line.get('Amount', 0))
                    desc      = (line.get('Description') or '')[:255]
                    acct      = account_map.get(acct_name) or account_code_map.get(acct_num)
                    if not acct:
                        continue  # account is required (non-null FK) — skip unmatched lines
                    JournalLine.objects.create(
                        journal=je, account=acct, description=desc,
                        debit=amount  if posting == 'Debit'  else Decimal('0'),
                        credit=amount if posting == 'Credit' else Decimal('0'),
                    )
                ok += 1
            except Exception as e:
                fail += 1
                errors.append(f'JournalEntry {doc_num}: {e}')

        return ok, fail, errors

    # ── Pull: Bank Transactions / Deposits (QB → Lakezone) ────────────────────

    def pull_bank_transactions(self):
        from .models import BankTransaction, Account
        ok, fail, errors = 0, 0, []

        if not self.user:
            return 0, 0, ['pull_bank_transactions requires a user context']

        account_map = {a.name.lower(): a for a in Account.objects.filter(is_active=True)}

        try:
            resp = self.query('SELECT * FROM Deposit MAXRESULTS 1000')
            deposits = resp.get('QueryResponse', {}).get('Deposit', [])
        except Exception as e:
            deposits = []
            errors.append(f'Failed to fetch deposits: {e}')

        for dep in deposits:
            ref      = f'QB-DEP-{dep.get("Id", "")}'
            txn_date = dep.get('TxnDate', '')
            total    = _safe_decimal(dep.get('TotalAmt', 0))
            memo     = (dep.get('PrivateNote') or '').strip()
            acct_ref = dep.get('DepositToAccountRef') or {}
            acct     = account_map.get(acct_ref.get('name', '').lower())
            try:
                BankTransaction.objects.update_or_create(
                    reference=ref[:100],
                    defaults={
                        'txn_date': _safe_date(txn_date), 'txn_type': 'deposit',
                        'account': acct, 'amount': total, 'description': memo,
                        'source': 'quickbooks', 'created_by': self.user,
                    },
                )
                ok += 1
            except Exception as e:
                fail += 1; errors.append(f'{ref}: {e}')

        try:
            resp = self.query('SELECT * FROM Transfer MAXRESULTS 1000')
            transfers = resp.get('QueryResponse', {}).get('Transfer', [])
        except Exception as e:
            transfers = []
            errors.append(f'Failed to fetch transfers: {e}')

        for txf in transfers:
            ref      = f'QB-TRF-{txf.get("Id", "")}'
            txn_date = txf.get('TxnDate', '')
            amount   = _safe_decimal(txf.get('Amount', 0))
            memo     = (txf.get('PrivateNote') or '').strip()
            acct     = account_map.get((txf.get('FromAccountRef') or {}).get('name', '').lower())
            try:
                BankTransaction.objects.update_or_create(
                    reference=ref[:100],
                    defaults={
                        'txn_date': _safe_date(txn_date), 'txn_type': 'transfer',
                        'account': acct, 'amount': amount, 'description': memo,
                        'source': 'quickbooks', 'created_by': self.user,
                    },
                )
                ok += 1
            except Exception as e:
                fail += 1; errors.append(f'{ref}: {e}')

        return ok, fail, errors

    # ── Pull: Credit Memos & Vendor Credits (QB → Lakezone) ───────────────────

    def pull_credit_notes(self):
        from .models import CreditNote
        from crm.models import Client
        from procurement.models import Supplier
        ok, fail, errors = 0, 0, []

        if not self.user:
            return 0, 0, ['pull_credit_notes requires a user context']

        client_map   = {c.company_name.lower(): c for c in Client.objects.all()}
        supplier_map = {s.company_name.lower(): s for s in Supplier.objects.all()}

        try:
            resp = self.query('SELECT * FROM CreditMemo MAXRESULTS 1000')
            credit_memos = resp.get('QueryResponse', {}).get('CreditMemo', [])
        except Exception as e:
            credit_memos = []
            errors.append(f'Failed to fetch credit memos: {e}')

        for cm in credit_memos:
            ref      = (cm.get('DocNumber') or f'QB-CM-{cm.get("Id", "")}').strip()
            txn_date = cm.get('TxnDate', '')
            total    = _safe_decimal(cm.get('TotalAmt', 0))
            balance  = _safe_decimal(cm.get('RemainingCredit', total))
            memo     = (cm.get('CustomerMemo') or {}).get('value', '') or (cm.get('PrivateNote') or '')
            client   = client_map.get((cm.get('CustomerRef') or {}).get('name', '').lower())
            try:
                CreditNote.objects.update_or_create(
                    reference=ref[:50],
                    defaults={
                        'credit_type': 'ar', 'txn_date': _safe_date(txn_date),
                        'client': client, 'amount': total, 'balance': balance,
                        'memo': str(memo)[:500], 'status': 'open' if balance > 0 else 'applied',
                        'source': 'quickbooks', 'created_by': self.user,
                    },
                )
                ok += 1
            except Exception as e:
                fail += 1; errors.append(f'CreditMemo {ref}: {e}')

        try:
            resp = self.query('SELECT * FROM VendorCredit MAXRESULTS 1000')
            vendor_credits = resp.get('QueryResponse', {}).get('VendorCredit', [])
        except Exception as e:
            vendor_credits = []
            errors.append(f'Failed to fetch vendor credits: {e}')

        for vc in vendor_credits:
            ref      = (vc.get('DocNumber') or f'QB-VC-{vc.get("Id", "")}').strip()
            txn_date = vc.get('TxnDate', '')
            total    = _safe_decimal(vc.get('TotalAmt', 0))
            memo     = (vc.get('PrivateNote') or '').strip()
            supplier = supplier_map.get((vc.get('VendorRef') or {}).get('name', '').lower())
            try:
                CreditNote.objects.update_or_create(
                    reference=ref[:50],
                    defaults={
                        'credit_type': 'ap', 'txn_date': _safe_date(txn_date),
                        'supplier': supplier, 'amount': total, 'balance': total,
                        'memo': memo[:500], 'status': 'open',
                        'source': 'quickbooks', 'created_by': self.user,
                    },
                )
                ok += 1
            except Exception as e:
                fail += 1; errors.append(f'VendorCredit {ref}: {e}')

        return ok, fail, errors
