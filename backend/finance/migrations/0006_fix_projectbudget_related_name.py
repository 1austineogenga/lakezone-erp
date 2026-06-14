from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0005_payroll_gl_journal'),
        ('projects', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='projectbudget',
            name='project',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name='finance_budgets',
                to='projects.project',
            ),
        ),
    ]
