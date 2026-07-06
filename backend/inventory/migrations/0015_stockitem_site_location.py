from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0014_stockitem_branch'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='stockitem',
            name='branch',
        ),
        migrations.AddField(
            model_name='stockitem',
            name='site_location',
            field=models.CharField(blank=True, default='', max_length=200),
        ),
    ]
