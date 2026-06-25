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
