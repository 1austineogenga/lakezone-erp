from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0010_gl_auto_journal_reconciliation'),
    ]

    operations = [
        migrations.AddField(
            model_name='banktransaction',
            name='category',
            field=models.CharField(
                blank=True,
                default='',
                help_text='Expense category (e.g. from QuickBooks account name)',
                max_length=255,
            ),
        ),
    ]
