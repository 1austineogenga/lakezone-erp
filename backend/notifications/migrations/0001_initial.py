from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("type", models.CharField(
                    choices=[
                        ("pr_approved", "PR Approved"),
                        ("pr_rejected", "PR Rejected"),
                        ("pr_submitted", "PR Submitted for Approval"),
                        ("po_approved", "PO Approved"),
                        ("low_stock", "Low Stock Alert"),
                        ("tender_due", "Tender Deadline Soon"),
                        ("ipc_issued", "IPC Issued"),
                        ("general", "General"),
                    ],
                    default="general",
                    max_length=30,
                )),
                ("title", models.CharField(max_length=255)),
                ("message", models.TextField()),
                ("link", models.CharField(blank=True, max_length=500)),
                ("is_read", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("recipient", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="notifications",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
