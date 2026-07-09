import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


SHIFT_CHOICES = [
    ('day',   'Day'),
    ('night', 'Night'),
    ('full',  'Full Day'),
]

LABOUR_ROLE_CHOICES = [
    ('engineer',       'Engineer'),
    ('foreman',        'Foreman'),
    ('supervisor',     'Supervisor'),
    ('artisan',        'Artisan'),
    ('operator',       'Operator'),
    ('driver',         'Driver'),
    ('labourer',       'Labourer'),
    ('surveyor',       'Surveyor'),
    ('safety_officer', 'Safety Officer'),
    ('other',          'Other'),
]

EQUIPMENT_TYPE_CHOICES = [
    ('excavator',     'Excavator'),
    ('grader',        'Grader'),
    ('roller',        'Roller / Compactor'),
    ('tipper',        'Tipper Truck'),
    ('concrete_mixer','Concrete Mixer'),
    ('crane',         'Crane'),
    ('bulldozer',     'Bulldozer'),
    ('water_bowser',  'Water Bowser'),
    ('generator',     'Generator'),
    ('vehicle',       'Vehicle / Pickup'),
    ('other',         'Other'),
]

STATUS_CHOICES = [
    ('active',    'Active'),
    ('standby',   'Standby'),
    ('breakdown', 'Breakdown'),
    ('completed', 'Completed'),
]


class LabourDeployment(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_name    = models.CharField(max_length=255)
    project_id      = models.UUIDField(null=True, blank=True, db_index=True)
    employee        = models.ForeignKey('hr.Employee', on_delete=models.PROTECT, related_name='deployments')
    activity        = models.CharField(max_length=255, blank=True, help_text='Task / activity description')
    role            = models.CharField(max_length=30, choices=LABOUR_ROLE_CHOICES, default='labourer')
    date            = models.DateField(default=timezone.now)
    shift           = models.CharField(max_length=10, choices=SHIFT_CHOICES, default='day')
    hours_worked    = models.DecimalField(max_digits=5, decimal_places=2, default=8)
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    notes           = models.TextField(blank=True)
    recorded_by     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='labour_deployments_recorded')
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', 'employee__last_name']

    def __str__(self):
        return f'{self.employee} — {self.project_name} ({self.date})'


class EquipmentDeployment(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_name    = models.CharField(max_length=255)
    project_id      = models.UUIDField(null=True, blank=True, db_index=True)
    vehicle         = models.ForeignKey('fleet.Vehicle', on_delete=models.PROTECT, null=True, blank=True, related_name='deployments')
    equipment_type  = models.CharField(max_length=30, choices=EQUIPMENT_TYPE_CHOICES, default='other')
    equipment_id_ref= models.CharField(max_length=100, blank=True, help_text='Reg no / asset tag if not in fleet')
    activity        = models.CharField(max_length=255, blank=True)
    date            = models.DateField(default=timezone.now)
    shift           = models.CharField(max_length=10, choices=SHIFT_CHOICES, default='day')
    hours_worked    = models.DecimalField(max_digits=5, decimal_places=2, default=8)
    operator_name   = models.CharField(max_length=150, blank=True)
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    breakdown_notes = models.TextField(blank=True)
    notes           = models.TextField(blank=True)
    recorded_by     = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='equipment_deployments_recorded')
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        ref = self.vehicle.vehicle_no if self.vehicle else self.equipment_id_ref
        return f'{ref} — {self.project_name} ({self.date})'
