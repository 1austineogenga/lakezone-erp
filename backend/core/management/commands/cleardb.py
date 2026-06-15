"""
Management command: python manage.py cleardb

Clears all business data while keeping superusers and migrations intact.
Prompts for confirmation unless --yes is passed.
"""
from django.core.management.base import BaseCommand
from django.db import connection, transaction


class Command(BaseCommand):
    help = 'Clear all business data from the database (keeps superusers)'

    def add_arguments(self, parser):
        parser.add_argument('--yes', action='store_true', help='Skip confirmation prompt')

    def handle(self, *args, **options):
        if not options['yes']:
            confirm = input('\nThis will DELETE all business data (projects, HR, finance, etc.).\nSuperusers are kept. Type YES to continue: ')
            if confirm.strip() != 'YES':
                self.stdout.write(self.style.WARNING('Aborted.'))
                return

        self.stdout.write(self.style.MIGRATE_HEADING('\n=== Clearing database ===\n'))

        tables = [
            # Notifications
            'notifications_notification',
            # Finance
            'finance_journalentryline', 'finance_journalentry',
            'finance_timesheetentry', 'finance_timesheet',
            'finance_performancebond', 'finance_paymentcertificate',
            'finance_whtentry', 'finance_vatreturn',
            'finance_retentionrelease',
            'finance_expenseclaimitem', 'finance_expenseclaim',
            'finance_payment',
            'finance_billline', 'finance_bill',
            'finance_invoiceline', 'finance_invoice',
            'finance_projectbudget',
            'finance_account',
            # Procurement
            'procurement_poline', 'procurement_purchaseorder',
            'procurement_prline', 'procurement_purchaserequisition',
            'procurement_supplier',
            # Requisitions
            'requisitions_requisitionapproval',
            'requisitions_requisitionitem',
            'requisitions_staffrequisition',
            # Inventory
            'inventory_stockmovement',
            'inventory_stocklevel',
            'inventory_stockitem',
            # Assets
            'inventory_assetmaintenance',
            'inventory_asset',
            # CRM
            'crm_opportunity',
            'crm_client',
            # Fleet
            'fleet_alert', 'fleet_trip', 'fleet_fuellog',
            'fleet_maintenance', 'fleet_vehicle',
            # Projects
            'projects_weeklyprogress',
            'projects_projectpersonnel', 'projects_projectvehicle',
            'projects_projectrisk',
            'projects_ipcitem', 'projects_ipc',
            'projects_budgetlineitem', 'projects_budgetrate', 'projects_budget',
            'projects_boqitem', 'projects_boqbill', 'projects_boq',
            'projects_project',
            # HR
            'hr_payrollentry', 'hr_payrollperiod',
            'hr_salaryadvance',
            'hr_leaveapplication', 'hr_leavebalance', 'hr_leavetype',
            'hr_biometriclog', 'hr_attendancerecord',
            'hr_disciplinaryaction',
            'hr_employeetransfer',
            'hr_employee',
            # Core (non-superuser)
            'core_department', 'core_branch',
            'token_blacklist_blacklistedtoken', 'token_blacklist_outstandingtoken',
            'auditlog_logentry',
        ]

        with connection.cursor() as cursor:
            cursor.execute('SET session_replication_role = replica;')
            for table in tables:
                try:
                    cursor.execute(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE;')
                    self.stdout.write(f'  ✓ {table}')
                except Exception as e:
                    self.stdout.write(self.style.WARNING(f'  ! {table}: {e}'))
            cursor.execute('SET session_replication_role = DEFAULT;')

        # Delete non-superuser users
        from core.models import User
        deleted, _ = User.objects.filter(is_superuser=False).delete()
        self.stdout.write(f'  ✓ Deleted {deleted} non-superuser users')

        self.stdout.write(self.style.SUCCESS('\n✓ Database cleared. Superusers preserved.\n'))
