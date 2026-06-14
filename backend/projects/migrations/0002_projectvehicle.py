import uuid
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fleet', '0001_initial'),
        ('projects', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProjectVehicle',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('assigned_from', models.DateField()),
                ('assigned_to', models.DateField(blank=True, null=True)),
                ('daily_rate', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('notes', models.CharField(blank=True, max_length=500)),
                ('is_active', models.BooleanField(default=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='assigned_vehicles', to='projects.project')),
                ('vehicle', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='project_assignments', to='fleet.vehicle')),
            ],
        ),
    ]
