import logging
from celery import shared_task
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)

PULL_ORDER = [
    # (entity_key, pull_method_name)
    # Wave 1 — no dependencies
    ('accounts',          'pull_accounts'),
    ('customers',         'pull_customers'),
    ('vendors',           'pull_vendors'),
    # Wave 2 — depend on customers/vendors/accounts
    ('invoices',          'pull_invoices'),
    ('bills',             'pull_bills'),
    ('journal_entries',   'pull_journal_entries'),
    # Wave 3 — depend on invoices/bills
    ('payments',          'pull_payments'),
    # Wave 4 — supplementary
    ('bank_transactions', 'pull_bank_transactions'),
    ('credit_notes',      'pull_credit_notes'),
]


@shared_task(name='finance.qb_full_sync', bind=True, max_retries=2)
def qb_full_sync(self):
    """
    Pull all entities from QuickBooks in the correct dependency order.
    Runs hourly via django-celery-beat.
    """
    from .models import QuickBooksConfig, QBSyncLog
    from .qb_service import QBService

    config = QuickBooksConfig.objects.filter(
        pk='00000000-0000-0000-0000-000000000001'
    ).first()

    if not config or not config.is_connected:
        logger.info('QB auto-sync skipped: not connected.')
        return {'skipped': True, 'reason': 'not connected'}

    # Use the first superuser as the system actor for recorded_by fields
    User = get_user_model()
    system_user = User.objects.filter(is_superuser=True).order_by('date_joined').first()

    svc = QBService(config, user=system_user)
    results = {}

    for entity, method_name in PULL_ORDER:
        try:
            pull_fn = getattr(svc, method_name)
            ok, fail, errors = pull_fn()
            results[entity] = {'ok': ok, 'fail': fail, 'errors': errors[:5]}
            status_val = 'success' if fail == 0 else ('partial' if ok > 0 else 'failed')
            QBSyncLog.objects.create(
                entity_type=entity,
                direction='pull',
                status=status_val,
                records_ok=ok,
                records_fail=fail,
                error_detail='\n'.join(errors) if errors else '',
            )
            if errors:
                logger.warning('QB sync %s: %d ok, %d fail — %s', entity, ok, fail, errors[:2])
            else:
                logger.info('QB sync %s: %d ok', entity, ok)
        except Exception as exc:
            logger.exception('QB sync failed for %s: %s', entity, exc)
            results[entity] = {'ok': 0, 'fail': -1, 'error': str(exc)}
            QBSyncLog.objects.create(
                entity_type=entity,
                direction='pull',
                status='failed',
                records_ok=0,
                records_fail=0,
                error_detail=str(exc),
            )

    from django.utils import timezone
    config.last_sync_at = timezone.now()
    config.save(update_fields=['last_sync_at'])

    return results
