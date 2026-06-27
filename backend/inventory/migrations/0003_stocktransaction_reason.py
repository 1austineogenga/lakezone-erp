from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0002_asset_assetmaintenancelog"),
    ]

    operations = [
        migrations.AddField(
            model_name="stocktransaction",
            name="reason",
            field=models.TextField(
                blank=True,
                help_text="Required for ADJUSTMENT transactions. Explain why the adjustment is being made.",
            ),
        ),
    ]
