from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('projects', '0003_project_lat_lng'),
    ]

    operations = [
        migrations.AddField(
            model_name='boqitem',
            name='actual_cost',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=15),
        ),
    ]
