from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0004_stockitem_department'),
    ]

    operations = [
        # Category & status choices update
        migrations.AlterField(
            model_name='asset',
            name='category',
            field=models.CharField(
                choices=[
                    ('machinery', 'Machinery & Plant'),
                    ('vehicles', 'Vehicles (Cars / SUVs / Double Cabs)'),
                    ('trucks_tracks', 'Trucks & Tracks'),
                    ('it_equipment', 'IT Equipment'),
                    ('furniture', 'Furniture & Fittings'),
                    ('office_equipment', 'Office Equipment'),
                    ('tools', 'Tools & Equipment'),
                    ('communication', 'Communication Equipment'),
                    ('safety', 'Safety Equipment'),
                    ('other', 'Other'),
                ],
                max_length=30,
            ),
        ),
        migrations.AlterField(
            model_name='asset',
            name='status',
            field=models.CharField(
                choices=[
                    ('operational', 'Operational'),
                    ('functional', 'Functional'),
                    ('non_operational', 'Non-Operational'),
                    ('undetermined', 'Undetermined'),
                    ('active', 'Active'),
                    ('under_repair', 'Under Repair'),
                    ('disposed', 'Disposed'),
                    ('lost', 'Lost'),
                ],
                default='operational',
                max_length=20,
            ),
        ),
        # Machinery
        migrations.AddField(
            model_name='asset',
            name='hours_to_next_service',
            field=models.DecimalField(blank=True, decimal_places=1, max_digits=8, null=True),
        ),
        # Vehicle / Truck common
        migrations.AddField(
            model_name='asset',
            name='registration_plate',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='asset',
            name='kms_to_next_service',
            field=models.IntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='asset',
            name='insurance_expiry',
            field=models.DateField(blank=True, null=True),
        ),
        # Insurance certificate full details
        migrations.AddField(
            model_name='asset',
            name='insurance_cert_number',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='asset',
            name='insurance_policy_number',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='asset',
            name='insurance_policy_type',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='asset',
            name='insurance_insurer',
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name='asset',
            name='insurance_chassis_number',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='asset',
            name='insurance_commencement_date',
            field=models.DateField(blank=True, null=True),
        ),
        # Inspection certificate
        migrations.AddField(
            model_name='asset',
            name='inspection_cert_number',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='asset',
            name='inspection_cert_status',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='asset',
            name='inspection_cert_issue_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='asset',
            name='inspection_cert_expiry',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='asset',
            name='inspection_issuing_authority',
            field=models.CharField(blank=True, max_length=200),
        ),
        # Speed governor certificate
        migrations.AddField(
            model_name='asset',
            name='speed_governor_cert_number',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='asset',
            name='speed_governor_cert_status',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='asset',
            name='speed_governor_device_serial',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='asset',
            name='speed_governor_cert_issue_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='asset',
            name='speed_governor_cert_expiry',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='asset',
            name='speed_governor_issuing_authority',
            field=models.CharField(blank=True, max_length=200),
        ),
        # Defects & requirements
        migrations.AddField(
            model_name='asset',
            name='current_defects',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='asset',
            name='requirements',
            field=models.TextField(blank=True),
        ),
    ]
