from django.db import migrations

OLD_STORES = ['HR Store', 'Finance Store', 'Procurement Store']
RENAME_MAP = {}  # nothing to rename, just add Kitchen Store
ADD_STORES = ['Kitchen Store']


def update_stores(apps, schema_editor):
    Store = apps.get_model('inventory', 'Store')
    StockLevel = apps.get_model('inventory', 'StockLevel')

    # Add Kitchen Store if missing
    for name in ADD_STORES:
        Store.objects.get_or_create(name=name, defaults={'is_active': True})

    # Remove old stores only if they have no stock levels
    used_ids = StockLevel.objects.values_list('store_id', flat=True)
    Store.objects.filter(name__in=OLD_STORES).exclude(id__in=used_ids).delete()

    # Deactivate old stores that still have stock (can't delete)
    Store.objects.filter(name__in=OLD_STORES).update(is_active=False)


def reverse_stores(apps, schema_editor):
    Store = apps.get_model('inventory', 'Store')
    for name in ADD_STORES:
        Store.objects.filter(name=name).delete()
    for name in OLD_STORES:
        Store.objects.get_or_create(name=name, defaults={'is_active': True})


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0008_seed_default_stores'),
    ]

    operations = [
        migrations.RunPython(update_stores, reverse_stores),
    ]
