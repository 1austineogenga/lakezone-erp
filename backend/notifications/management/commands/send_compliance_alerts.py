"""
Daily command: scan vehicle compliance records and send notifications to
system_admin, admin_officer, fleet_manager users for expiring/expired docs.

Cron: 0 7 * * *  (run at 07:00 every day)
"""
from datetime import date, timedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from fleet.models import VehicleCompliance
from notifications.models import Notification

User = get_user_model()

WARN_DAYS = 30   # days before expiry to start warning
CRITICAL_DAYS = 7  # days before expiry = critical

RECIPIENT_ROLES = {'system_admin', 'admin_officer', 'fleet_manager', 'facility_manager'}

LABEL = {
    'insurance':     'Insurance',
    'inspection':    'Inspection Certificate',
    'speed_governor': 'Speed Governor Certificate',
}


class Command(BaseCommand):
    help = 'Send compliance expiry alerts for vehicles/fleet'

    def handle(self, *args, **options):
        today = date.today()
        recipients = list(User.objects.filter(role__in=RECIPIENT_ROLES, is_active=True))
        if not recipients:
            self.stdout.write('No recipient users found.')
            return

        records = VehicleCompliance.objects.select_related('vehicle').filter(
            expiry_date__isnull=False
        ).exclude(status='not_applicable')

        sent = 0
        for rec in records:
            days_left = (rec.expiry_date - today).days
            vehicle_label = rec.vehicle.vehicle_name or rec.vehicle.vehicle_no
            doc_label = LABEL.get(rec.compliance_type, rec.compliance_type)

            if days_left < 0:
                notif_type = Notification.Type.COMPLIANCE_EXPIRY
                title = f'EXPIRED: {vehicle_label} — {doc_label}'
                message = (
                    f'{doc_label} for {vehicle_label} expired on {rec.expiry_date}. '
                    'Immediate action required.'
                )
            elif days_left <= CRITICAL_DAYS:
                notif_type = Notification.Type.COMPLIANCE_EXPIRY
                title = f'CRITICAL: {vehicle_label} — {doc_label} expires in {days_left} day(s)'
                message = (
                    f'{doc_label} for {vehicle_label} expires on {rec.expiry_date} '
                    f'({days_left} day(s) remaining). Renew immediately.'
                )
            elif days_left <= WARN_DAYS:
                notif_type = Notification.Type.COMPLIANCE_WARNING
                title = f'Expiring Soon: {vehicle_label} — {doc_label}'
                message = (
                    f'{doc_label} for {vehicle_label} expires on {rec.expiry_date} '
                    f'({days_left} days remaining). Plan renewal.'
                )
            else:
                continue  # not due for alert

            # Avoid duplicate alerts for today
            for user in recipients:
                already = Notification.objects.filter(
                    recipient=user,
                    type=notif_type,
                    title=title,
                    created_at__date=today,
                ).exists()
                if not already:
                    Notification.objects.create(
                        recipient=user,
                        type=notif_type,
                        title=title,
                        message=message,
                        link='/alerts',
                    )
                    sent += 1

        self.stdout.write(self.style.SUCCESS(f'Compliance alerts: {sent} notifications created.'))
