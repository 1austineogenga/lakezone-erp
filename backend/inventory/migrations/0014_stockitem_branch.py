from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
        ('inventory', '0013_storerequest_date_required'),
    ]

    operations = [
        migrations.AddField(
            model_name='stockitem',
            name='branch',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='stock_items',
                to='core.branch',
            ),
        ),
    ]
