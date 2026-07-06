from django.db import migrations

DEFAULT_STORES = [
    'General Store',
    'Admin Store',
    'HR Store',
    'Finance Store',
    'IT Store',
    'Site Store',
    'Procurement Store',
]


def seed_stores(apps, schema_editor):
    Store = apps.get_model('inventory', 'Store')
    for name in DEFAULT_STORES:
        Store.objects.get_or_create(name=name, defaults={'is_active': True})


def unseed_stores(apps, schema_editor):
    # Only remove stores that are still empty (no stock levels attached)
    Store = apps.get_model('inventory', 'Store')
    StockLevel = apps.get_model('inventory', 'StockLevel')
    used_ids = StockLevel.objects.values_list('store_id', flat=True)
    Store.objects.filter(name__in=DEFAULT_STORES).exclude(id__in=used_ids).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0007_add_created_by_to_stock_item'),
    ]

    operations = [
        migrations.RunPython(seed_stores, unseed_stores),
    ]
