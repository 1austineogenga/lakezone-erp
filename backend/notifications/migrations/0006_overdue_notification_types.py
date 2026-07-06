from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0005_sr_notification_types'),
    ]

    operations = [
        migrations.RunSQL(sql='SELECT 1', reverse_sql='SELECT 1'),
    ]
