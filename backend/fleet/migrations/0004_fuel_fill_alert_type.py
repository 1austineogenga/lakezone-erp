from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fleet', '0003_fleet_register_fields'),
    ]

    operations = [
        migrations.AlterField(
            model_name='fleetalert',
            name='alert_type',
            field=models.CharField(
                choices=[
                    ('sos', 'SOS Emergency'),
                    ('speeding', 'Overspeeding'),
                    ('low_fuel', 'Low Fuel'),
                    ('fuel_fill', 'Fuel Refill'),
                    ('fuel_drain', 'Fuel Drain/Theft'),
                    ('ignition_off_moving', 'Moving Without Ignition'),
                    ('idle_long', 'Long Idle'),
                    ('device_offline', 'Device Offline'),
                    ('insurance_expiry', 'Insurance Expiring/Expired'),
                    ('inspection_expiry', 'Inspection Cert Expiring/Expired'),
                    ('speed_governor_expiry', 'Speed Governor Cert Expiring/Expired'),
                    ('compliance_issue', 'Compliance Issue'),
                ],
                max_length=30,
            ),
        ),
    ]
