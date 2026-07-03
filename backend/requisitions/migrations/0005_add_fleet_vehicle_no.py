from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('requisitions', '0004_add_payment_details'),
    ]

    operations = [
        migrations.AddField(
            model_name='staffrequisition',
            name='fleet_vehicle_no',
            field=models.CharField(
                blank=True, max_length=50,
                help_text='Vehicle Reg / ID from fleet register; used to auto-log maintenance on fulfillment',
            ),
        ),
    ]
