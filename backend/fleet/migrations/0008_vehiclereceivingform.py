import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fleet', '0007_vehicle_source_is_live'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='VehicleReceivingForm',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('vehicle_make_model', models.CharField(max_length=200)),
                ('registration_number', models.CharField(max_length=50)),
                ('chassis_number', models.CharField(blank=True, default='', max_length=100)),
                ('date_of_inspection', models.DateField()),
                ('log_number', models.CharField(blank=True, default='', max_length=50)),
                ('mileage', models.DecimalField(blank=True, decimal_places=1, max_digits=10, null=True)),
                ('engine_oil_level', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('brake_system', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('steering_suspension', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('headlights_indicators', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('tires_condition', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('battery_condition', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('cooling_system', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('fuel_system', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('exhaust_system', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('body_frame_condition', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('wipers_washers_mirrors', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('horn', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('tipping_hydraulic_system', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='na', max_length=10)),
                ('inspection_notes', models.TextField(blank=True, default='')),
                ('compliance_certificate', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('compliance_certificate_expiry', models.DateField(blank=True, null=True)),
                ('insurance_expiry', models.DateField(blank=True, null=True)),
                ('speed_governor_expiry', models.DateField(blank=True, null=True)),
                ('mv_inspection_cert', models.CharField(choices=[('present', 'Present'), ('not_found', 'Not Found'), ('expired', 'Expired')], default='present', max_length=20)),
                ('mv_inspection_cert_expiry', models.DateField(blank=True, null=True)),
                ('spare_parts', models.JSONField(blank=True, default=list)),
                ('tools', models.JSONField(blank=True, default=list)),
                ('notes', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('vehicle', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='receiving_forms', to='fleet.vehicle')),
                ('submitted_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='vehicle_receiving_forms', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
