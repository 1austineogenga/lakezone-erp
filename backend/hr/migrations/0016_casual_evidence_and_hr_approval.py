from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('hr', '0015_add_probation_and_licence'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Make Casual.assignment optional
        migrations.AlterField(
            model_name='casual',
            name='assignment',
            field=models.TextField(blank=True, help_text='Work assigned to the casual'),
        ),

        # Add hr_approved status to CasualDailyReport
        migrations.AlterField(
            model_name='casualdailyreport',
            name='status',
            field=models.CharField(
                choices=[
                    ('draft', 'Draft'),
                    ('submitted', 'Submitted for Approval'),
                    ('hr_approved', 'HR Approved'),
                    ('approved', 'Approved'),
                    ('rejected', 'Rejected'),
                    ('paid', 'Paid'),
                ],
                default='draft',
                max_length=15,
            ),
        ),

        # Add hr_approved_by and hr_approved_at to CasualDailyReport
        migrations.AddField(
            model_name='casualdailyreport',
            name='hr_approved_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='casual_reports_hr_approved',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        migrations.AddField(
            model_name='casualdailyreport',
            name='hr_approved_at',
            field=models.DateTimeField(blank=True, null=True),
        ),

        # New CasualWorkEvidence model
        migrations.CreateModel(
            name='CasualWorkEvidence',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('work_date', models.DateField(db_index=True)),
                ('image', models.ImageField(upload_to='casual_evidence/%Y/%m/')),
                ('caption', models.CharField(blank=True, max_length=300)),
                ('casual', models.ForeignKey(
                    blank=True, null=True,
                    help_text='Leave blank for overall site evidence',
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='work_evidence',
                    to='hr.casual',
                )),
                ('uploaded_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='casual_evidence_uploaded',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
