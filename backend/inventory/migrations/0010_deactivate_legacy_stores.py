from django.db import migrations

LEGACY_STORES = [
    'Administration Store',
    'Finance and Accounts Store',
    'Human Resource Store',
    'Operations Store',
    'Security and Surveillance Store',
]


def deactivate_legacy(apps, schema_editor):
    Store = apps.get_model('inventory', 'Store')
    StockLevel = apps.get_model('inventory', 'StockLevel')
    used_ids = set(StockLevel.objects.values_list('store_id', flat=True))
    for store in Store.objects.filter(name__in=LEGACY_STORES):
        if store.id in used_ids:
            store.is_active = False
            store.save()
        else:
            store.delete()


def reactivate_legacy(apps, schema_editor):
    Store = apps.get_model('inventory', 'Store')
    for name in LEGACY_STORES:
        Store.objects.get_or_create(name=name, defaults={'is_active': True})


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0009_update_stores'),
    ]

    operations = [
        migrations.RunPython(deactivate_legacy, reactivate_legacy),
    ]
