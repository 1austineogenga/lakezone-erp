from django.db import migrations


def rename_department(apps, schema_editor):
    Department = apps.get_model('core', 'Department')
    Department.objects.filter(name='Site Operations').update(name='Operations')


def reverse_rename(apps, schema_editor):
    Department = apps.get_model('core', 'Department')
    Department.objects.filter(name='Operations').update(name='Site Operations')


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_auditlog'),
    ]

    operations = [
        migrations.RunPython(rename_department, reverse_rename),
    ]
