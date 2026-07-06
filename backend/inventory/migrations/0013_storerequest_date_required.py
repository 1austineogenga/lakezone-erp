from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0012_storerequest'),
    ]

    operations = [
        migrations.AddField(
            model_name='storerequest',
            name='date_required',
            field=models.DateField(null=True, blank=True),
        ),
    ]
