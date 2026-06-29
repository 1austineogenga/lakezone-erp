from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fleet', '0006_geofence_fuelevent_price_per_litre_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='vehicle',
            name='is_live',
            field=models.BooleanField(
                default=True,
                help_text='Vehicle is actively tracked in TrackNTrace/Trakzee',
            ),
        ),
        migrations.AddField(
            model_name='vehicle',
            name='source',
            field=models.CharField(
                choices=[
                    ('live',     'Live (TrackNTrace)'),
                    ('register', 'Asset Register'),
                    ('manual',   'Manually Added'),
                ],
                default='live',
                max_length=20,
            ),
        ),
    ]
