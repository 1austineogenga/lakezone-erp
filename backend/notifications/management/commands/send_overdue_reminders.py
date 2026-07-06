"""
Daily management command — send overdue reminders for store requests and requisitions.

Schedule (cron):  0 7 * * *   (every day at 07:00)

Example:
    python manage.py send_overdue_reminders
    python manage.py send_overdue_reminders --dry-run
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from notifications.models import Notification
from notifications.signals import notify


class Command(BaseCommand):
    help = 'Send overdue reminder notifications for store requests and requisitions'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help='Print what would be sent without creating notifications',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        today   = timezone.now().date()
        sent    = 0

        # ── Store Requests ────────────────────────────────────────────────────
        from inventory.models import StoreRequest

        overdue_sr = StoreRequest.objects.filter(
            date_required__lt=today,
            status__in=[
                StoreRequest.Status.SUBMITTED,
                StoreRequest.Status.APPROVED,
                StoreRequest.Status.DISPATCHED,
            ],
        ).select_related('requested_by', 'item', 'source_store')

        for sr in overdue_sr:
            # Deduplicate — one reminder per request per day
            already_sent = Notification.objects.filter(
                recipient=sr.requested_by,
                type=Notification.Type.SR_OVERDUE,
                link=f'/workspace?tab=storerequests',
                created_at__date=today,
                title__contains=sr.reference,
            ).exists()
            if already_sent:
                continue

            days_late = (today - sr.date_required).days
            message = (
                f"Your store request {sr.reference} for {sr.item.name} "
                f"({sr.quantity_requested} {sr.item.unit}) from {sr.source_store.name} "
                f"was needed by {sr.date_required.strftime('%d %b %Y')} "
                f"({days_late} day{'s' if days_late != 1 else ''} ago) "
                f"and is currently {sr.get_status_display().lower()}."
            )
            if dry_run:
                self.stdout.write(f"[DRY RUN] SR overdue: {sr.requested_by} — {sr.reference}")
            else:
                notify(
                    recipient=sr.requested_by,
                    type_=Notification.Type.SR_OVERDUE,
                    title=f"Overdue: Store Request {sr.reference}",
                    message=message,
                    link='/workspace?tab=storerequests',
                )
            sent += 1

        # ── Requisitions ──────────────────────────────────────────────────────
        try:
            from requisitions.models import StaffRequisition

            overdue_req = StaffRequisition.objects.filter(
                date_required__lt=today,
                status__in=['submitted', 'dept_review', 'finance', 'md_review'],
            ).select_related('requested_by')

            for req in overdue_req:
                already_sent = Notification.objects.filter(
                    recipient=req.requested_by,
                    type=Notification.Type.REQ_OVERDUE,
                    link=f'/requisitions/{req.id}',
                    created_at__date=today,
                ).exists()
                if already_sent:
                    continue

                days_late = (today - req.date_required).days
                message = (
                    f"Your requisition {req.reference_number} — \"{req.title}\" "
                    f"was required by {req.date_required.strftime('%d %b %Y')} "
                    f"({days_late} day{'s' if days_late != 1 else ''} ago) "
                    f"and is still pending approval."
                )
                if dry_run:
                    self.stdout.write(f"[DRY RUN] REQ overdue: {req.requested_by} — {req.reference_number}")
                else:
                    notify(
                        recipient=req.requested_by,
                        type_=Notification.Type.REQ_OVERDUE,
                        title=f"Overdue: Requisition {req.reference_number}",
                        message=message,
                        link=f'/requisitions/{req.id}',
                    )
                sent += 1

        except ImportError:
            self.stdout.write(self.style.WARNING('requisitions app not found — skipping'))

        label = 'Would send' if dry_run else 'Sent'
        self.stdout.write(self.style.SUCCESS(f'{label} {sent} overdue reminder(s)'))
