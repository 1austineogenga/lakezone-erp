from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0002_projectvehicle'),
    ]

    operations = [
        migrations.AddField(
            model_name='project',
            name='latitude',
            field=models.DecimalField(blank=True, decimal_places=7, max_digits=10, null=True),
        ),
        migrations.AddField(
            model_name='project',
            name='longitude',
            field=models.DecimalField(blank=True, decimal_places=7, max_digits=10, null=True),
        ),
    ]
