from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fleet', '0004_fuel_fill_alert_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='vehiclelivedata',
            name='fuel_unit',
            field=models.CharField(blank=True, default='L', max_length=5),
        ),
        # FuelEvent unit field so we always know the unit stored
        migrations.AddField(
            model_name='fuelevent',
            name='fuel_unit',
            field=models.CharField(blank=True, default='L', max_length=5),
        ),
    ]
