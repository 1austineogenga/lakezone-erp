from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('requisitions', '0003_alter_requisitionapproval_stage_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='staffrequisition',
            name='payment_method',
            field=models.CharField(
                blank=True, max_length=20,
                choices=[('mpesa_paybill', 'M-Pesa Paybill'), ('mpesa_till', 'M-Pesa Till'), ('bank_transfer', 'Bank Transfer')],
            ),
        ),
        migrations.AddField(
            model_name='staffrequisition',
            name='payment_business_number',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='staffrequisition',
            name='payment_account_number',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='staffrequisition',
            name='payment_till_number',
            field=models.CharField(blank=True, max_length=50),
        ),
        migrations.AddField(
            model_name='staffrequisition',
            name='payment_bank_name',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='staffrequisition',
            name='payment_account_name',
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name='staffrequisition',
            name='payment_branch_name',
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
