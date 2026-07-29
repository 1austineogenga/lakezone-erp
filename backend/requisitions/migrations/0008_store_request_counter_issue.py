from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('requisitions', '0007_add_payment_send_money_phone'),
        ('inventory', '0016_it_fields'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Add store_request and staff_movement req types (CharField choices, no DB change needed — stored as text)
        # Add HR_APPROVED status (same — stored as text)

        # Add source_store FK to StaffRequisition
        migrations.AddField(
            model_name='staffrequisition',
            name='source_store',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='requisitions',
                to='inventory.store',
                help_text='For store_request type: the store items are drawn from',
            ),
        ),

        # Add asset_code to RequisitionItem
        migrations.AddField(
            model_name='requisitionitem',
            name='asset_code',
            field=models.CharField(
                blank=True, max_length=50,
                help_text='Asset code (LZ-XX-NNN) for asset-type store requests',
            ),
        ),

        # Create CounterIssueForm model
        migrations.CreateModel(
            name='CounterIssueForm',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('issued_by_name', models.CharField(blank=True, max_length=200)),
                ('issued_by_designation', models.CharField(blank=True, max_length=200)),
                ('issued_at', models.DateTimeField(blank=True, null=True)),
                ('received_by_name', models.CharField(blank=True, max_length=200)),
                ('received_by_designation', models.CharField(blank=True, max_length=200)),
                ('received_at', models.DateTimeField(blank=True, null=True)),
                ('gate_pass_number', models.CharField(blank=True, max_length=50)),
                ('security_cleared_by', models.CharField(blank=True, max_length=200)),
                ('issue_notes', models.TextField(blank=True)),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending Issue'),
                        ('issued', 'Issued by Storekeeper'),
                        ('received', 'Receipt Confirmed'),
                        ('complete', 'Complete'),
                    ],
                    default='pending', max_length=10,
                )),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('issued_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='counter_issues_issued',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('received_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='counter_issues_received',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('requisition', models.OneToOneField(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='counter_issue',
                    to='requisitions.staffrequisition',
                )),
            ],
            options={'ordering': ['-created_at']},
        ),
    ]
