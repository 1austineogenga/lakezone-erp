from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('requisitions', '0005_add_fleet_vehicle_no'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name='staffrequisition',
            name='status',
            field=models.CharField(
                choices=[
                    ('draft', 'Draft'), ('submitted', 'Submitted'),
                    ('approved', 'Approved'), ('rejected', 'Rejected'),
                    ('paid', 'Paid'), ('fulfilled', 'Fulfilled'),
                    ('dept_review', 'Department Review'),
                    ('finance', 'Finance Review'), ('md_review', 'MD Review'),
                ],
                default='submitted', max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='staffrequisition',
            name='paid_by',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='requisitions_paid', to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='staffrequisition',
            name='paid_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='staffrequisition',
            name='paid_mode',
            field=models.CharField(
                blank=True, max_length=20,
                choices=[('finance_raised', 'Finance Raised Payment'), ('md_paid', 'MD Paid Directly')],
            ),
        ),
        migrations.AddField(
            model_name='staffrequisition',
            name='payment_confirmed_notes',
            field=models.TextField(blank=True),
        ),
    ]
