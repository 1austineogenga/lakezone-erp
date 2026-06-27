"""
Audit log signals for sensitive models.

This module wires post_save / post_delete signals to create AuditLog records
for User, PayrollEntry, JournalEntry, Invoice, and Bill.

It is imported from core/apps.py ready() to ensure signals are registered.
"""
import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

logger = logging.getLogger(__name__)

SENSITIVE_MODELS = [
    "core.User",
    "hr.PayrollEntry",
    "finance.JournalEntry",
    "finance.Invoice",
    "finance.Bill",
]

# We store the current request user via a thread-local populated by the middleware.
import threading
_audit_local = threading.local()


def get_audit_user():
    return getattr(_audit_local, "user", None)


def set_audit_user(user):
    _audit_local.user = user


def _log_change(sender, instance, action, **kwargs):
    from core.models import AuditLog
    try:
        AuditLog.objects.create(
            user=get_audit_user(),
            action=action,
            model_name=f"{instance._meta.app_label}.{instance.__class__.__name__}",
            object_id=str(instance.pk),
            changes={},
        )
    except Exception as exc:
        logger.error("AuditLog creation failed for %s %s: %s", action, instance, exc)


def _connect_for(app_label, model_name):
    label = f"{app_label}.{model_name}"

    @receiver(post_save, sender=label, weak=False)
    def on_save(sender, instance, created, **kwargs):
        action = "CREATE" if created else "UPDATE"
        _log_change(sender, instance, action)

    @receiver(post_delete, sender=label, weak=False)
    def on_delete(sender, instance, **kwargs):
        _log_change(sender, instance, "DELETE")


for _dotted in SENSITIVE_MODELS:
    _app, _model = _dotted.split(".")
    _connect_for(_app, _model)
