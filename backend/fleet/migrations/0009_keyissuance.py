import uuid
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fleet', '0008_vehiclereceivingform'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='KeyIssuance',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('issued_to_name', models.CharField(max_length=200)),
                ('requested_by_name', models.CharField(max_length=200)),
                ('requested_by_role', models.CharField(choices=[('managing_director', 'Managing Director'), ('hr_manager', 'HR Manager'), ('admin_officer', 'Admin Officer'), ('project_manager', 'Project Manager'), ('site_manager', 'Site Manager'), ('other', 'Other')], default='other', max_length=50)),
                ('destination', models.CharField(max_length=300)),
                ('purpose', models.TextField(blank=True, default='')),
                ('issue_datetime', models.DateTimeField()),
                ('expected_return_datetime', models.DateTimeField()),
                ('issue_mileage', models.DecimalField(blank=True, decimal_places=1, max_digits=10, null=True)),
                ('pre_fuel_level', models.CharField(choices=[('full', 'Full'), ('three_quarter', '3/4'), ('half', '1/2'), ('quarter', '1/4'), ('empty', 'Empty')], default='full', max_length=20)),
                ('pre_engine_oil', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('pre_tire_condition', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('pre_body_condition', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('pre_lights', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('pre_brakes', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('pre_wipers', models.CharField(choices=[('ok', 'OK'), ('not_ok', 'Not OK'), ('na', 'N/A')], default='ok', max_length=10)),
                ('pre_notes', models.TextField(blank=True, default='')),
                ('actual_return_datetime', models.DateTimeField(blank=True, null=True)),
                ('return_mileage', models.DecimalField(blank=True, decimal_places=1, max_digits=10, null=True)),
                ('return_fuel_level', models.CharField(blank=True, default='', max_length=20)),
                ('return_engine_oil', models.CharField(blank=True, default='', max_length=10)),
                ('return_tire_condition', models.CharField(blank=True, default='', max_length=10)),
                ('return_body_condition', models.CharField(blank=True, default='', max_length=10)),
                ('return_lights', models.CharField(blank=True, default='', max_length=10)),
                ('return_brakes', models.CharField(blank=True, default='', max_length=10)),
                ('return_wipers', models.CharField(blank=True, default='', max_length=10)),
                ('return_notes', models.TextField(blank=True, default='')),
                ('delay_justification', models.TextField(blank=True, default='')),
                ('status', models.CharField(choices=[('out', 'Out'), ('returned', 'Returned'), ('overdue', 'Overdue')], default='out', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('vehicle', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='key_issuances', to='fleet.vehicle')),
                ('issued_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='key_issuances_issued', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
