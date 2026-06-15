import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0006_fix_projectbudget_related_name'),
        ('requisitions', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='expenseclaim',
            name='requisition',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='expense_claims',
                to='requisitions.staffrequisition',
            ),
        ),
    ]
