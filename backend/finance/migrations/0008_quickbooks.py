from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0007_expenseclaim_requisition'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='QuickBooksConfig',
            fields=[
                ('id',            models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('client_id',     models.CharField(max_length=255)),
                ('client_secret', models.CharField(max_length=255)),
                ('environment',   models.CharField(choices=[('sandbox','Sandbox'),('production','Production')], default='sandbox', max_length=10)),
                ('realm_id',      models.CharField(blank=True, help_text='QuickBooks Company ID', max_length=50)),
                ('access_token',  models.TextField(blank=True)),
                ('refresh_token', models.TextField(blank=True)),
                ('token_expiry',  models.DateTimeField(blank=True, null=True)),
                ('redirect_uri',  models.CharField(blank=True, max_length=500)),
                ('is_connected',  models.BooleanField(default=False)),
                ('last_sync_at',  models.DateTimeField(blank=True, null=True)),
                ('created_at',    models.DateTimeField(auto_now_add=True)),
                ('updated_at',    models.DateTimeField(auto_now=True)),
            ],
            options={'verbose_name': 'QuickBooks Config'},
        ),
        migrations.CreateModel(
            name='QBSyncLog',
            fields=[
                ('id',           models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('entity_type',  models.CharField(max_length=50)),
                ('direction',    models.CharField(choices=[('push','Push to QB'),('pull','Pull from QB')], max_length=10)),
                ('status',       models.CharField(choices=[('success','Success'),('partial','Partial'),('failed','Failed')], max_length=10)),
                ('records_ok',   models.IntegerField(default=0)),
                ('records_fail', models.IntegerField(default=0)),
                ('error_detail', models.TextField(blank=True)),
                ('created_at',   models.DateTimeField(auto_now_add=True)),
                ('triggered_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
