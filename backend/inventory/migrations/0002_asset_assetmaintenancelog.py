from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Asset',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('asset_code', models.CharField(max_length=30, unique=True)),
                ('name', models.CharField(max_length=200)),
                ('category', models.CharField(choices=[('it_equipment', 'IT Equipment'), ('furniture', 'Furniture & Fittings'), ('machinery', 'Machinery & Plant'), ('vehicles', 'Vehicles & Transport'), ('office_equipment', 'Office Equipment'), ('tools', 'Tools & Equipment'), ('communication', 'Communication Equipment'), ('safety', 'Safety Equipment'), ('other', 'Other')], max_length=30)),
                ('department', models.CharField(max_length=100)),
                ('serial_number', models.CharField(blank=True, max_length=100)),
                ('make_model', models.CharField(blank=True, max_length=200)),
                ('purchase_date', models.DateField(blank=True, null=True)),
                ('purchase_value', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('current_value', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('condition', models.CharField(choices=[('new', 'New'), ('good', 'Good'), ('fair', 'Fair'), ('poor', 'Poor'), ('condemned', 'Condemned')], default='good', max_length=20)),
                ('status', models.CharField(choices=[('active', 'Active'), ('under_repair', 'Under Repair'), ('disposed', 'Disposed'), ('lost', 'Lost')], default='active', max_length=20)),
                ('location', models.CharField(blank=True, max_length=200)),
                ('assigned_to', models.CharField(blank=True, max_length=200)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['department', 'category', 'asset_code'],
            },
        ),
        migrations.CreateModel(
            name='AssetMaintenanceLog',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('date', models.DateField()),
                ('description', models.TextField()),
                ('cost', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('performed_by', models.CharField(blank=True, max_length=200)),
                ('next_service_date', models.DateField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('asset', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='maintenance_logs', to='inventory.asset')),
            ],
            options={
                'ordering': ['-date'],
            },
        ),
    ]
