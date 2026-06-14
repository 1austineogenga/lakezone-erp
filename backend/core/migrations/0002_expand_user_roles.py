from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(
                choices=[
                    ('system_admin', 'System Administrator'),
                    ('managing_director', 'Managing Director'),
                    ('general_manager', 'General Manager'),
                    ('finance_officer', 'Finance Officer'),
                    ('hr_manager', 'HR Manager'),
                    ('procurement_officer', 'Procurement Officer'),
                    ('facility_manager', 'Facility Manager'),
                    ('admin_officer', 'Admin Officer'),
                    ('site_manager', 'Site Manager'),
                    ('site_engineer', 'Site Engineer'),
                    ('site_foreman', 'Site Foreman'),
                    ('site_surveyor', 'Site Surveyor'),
                    ('mechanic', 'Mechanic'),
                    ('welder', 'Welder'),
                    ('equipment_operator', 'Machine Operator'),
                    ('driver', 'Driver'),
                    ('head_of_security', 'Head of Security'),
                    ('surveillance_officer', 'Surveillance Officer'),
                    ('chef', 'Chef'),
                    ('cleaner', 'Cleaner'),
                    ('finance_manager', 'Finance Manager'),
                    ('project_manager', 'Project Manager'),
                    ('storekeeper', 'Storekeeper'),
                    ('fleet_manager', 'Fleet Manager'),
                    ('sales_officer', 'Sales Officer'),
                ],
                default='site_engineer',
                max_length=50,
            ),
        ),
    ]
