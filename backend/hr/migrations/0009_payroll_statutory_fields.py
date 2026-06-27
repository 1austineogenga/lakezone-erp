"""
Migration 0009: Add approved_by/approved_at to PayrollPeriod, daily_rate to PayrollEntry.
"""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('hr', '0008_casual_models'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # PayrollPeriod: approved_by + approved_at
        migrations.AddField(
            model_name='payrollperiod',
            name='approved_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='payroll_periods_approved',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='payrollperiod',
            name='approved_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        # PayrollEntry: daily_rate
        migrations.AddField(
            model_name='payrollentry',
            name='daily_rate',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10),
        ),
    ]
