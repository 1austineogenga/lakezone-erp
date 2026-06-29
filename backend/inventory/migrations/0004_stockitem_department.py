from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_auditlog'),
        ('inventory', '0003_stocktransaction_reason'),
    ]

    operations = [
        migrations.AddField(
            model_name='stockitem',
            name='department',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='stock_items',
                to='core.department',
            ),
        ),
    ]
