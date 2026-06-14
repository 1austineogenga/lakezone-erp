from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0002_expand_user_roles'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='profile_photo',
            field=models.ImageField(blank=True, null=True, upload_to='profile_photos/'),
        ),
    ]
