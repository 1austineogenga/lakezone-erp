from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hr', '0013_movement_allowance_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='employeetransfer',
            name='transport_to',
            field=models.DecimalField(
                decimal_places=2, default=0, max_digits=10,
                help_text='Transport cost to destination (variable)',
            ),
        ),
        migrations.AddField(
            model_name='employeetransfer',
            name='transport_from',
            field=models.DecimalField(
                decimal_places=2, default=0, max_digits=10,
                help_text='Transport cost from destination back (variable)',
            ),
        ),
    ]
