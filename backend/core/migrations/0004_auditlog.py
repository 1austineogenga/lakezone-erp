from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0003_user_profile_photo"),
    ]

    operations = [
        migrations.CreateModel(
            name="AuditLog",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("action", models.CharField(
                    choices=[("CREATE", "Create"), ("UPDATE", "Update"), ("DELETE", "Delete")],
                    max_length=10,
                )),
                ("model_name", models.CharField(max_length=100)),
                ("object_id", models.CharField(max_length=100)),
                ("timestamp", models.DateTimeField(default=django.utils.timezone.now)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("changes", models.JSONField(blank=True, default=dict)),
                ("user", models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name="audit_logs",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                "ordering": ["-timestamp"],
            },
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["model_name", "object_id"], name="core_audit_model_idx"),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["user"], name="core_audit_user_idx"),
        ),
    ]
