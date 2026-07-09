import uuid
import zoneinfo
from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone

User = get_user_model()
NAIROBI = zoneinfo.ZoneInfo('Africa/Nairobi')


def _is_editable(submitted_at):
    if not submitted_at:
        return False
    now = timezone.now().astimezone(NAIROBI)
    submitted_local = submitted_at.astimezone(NAIROBI)
    cutoff = submitted_local.replace(hour=23, minute=59, second=59, microsecond=999999)
    return now <= cutoff


class BaseReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_name = models.CharField(max_length=200)
    contract_no = models.CharField(max_length=100, blank=True)
    location = models.CharField(max_length=200, blank=True)
    submitted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='+')
    submitted_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True
        ordering = ['-submitted_at']

    @property
    def is_editable(self):
        return _is_editable(self.submitted_at)


class ForemanDailyReport(BaseReport):
    date = models.DateField()
    day = models.CharField(max_length=20, blank=True)
    weather = models.CharField(max_length=100, blank=True)
    # A. Labour
    skilled_labour = models.IntegerField(default=0)
    semi_skilled = models.IntegerField(default=0)
    unskilled = models.IntegerField(default=0)
    operators = models.IntegerField(default=0)
    supervisors = models.IntegerField(default=0)
    visitors = models.IntegerField(default=0)
    total_workforce = models.IntegerField(default=0)
    shift_hours = models.CharField(max_length=50, blank=True)
    # B. Plant/Equipment — [{plant, id_unit, qty, status, remarks}]
    plant_equipment = models.JSONField(default=list)
    # C. Work activities — [{no, location, description, unit_qty, remarks}]
    work_activities = models.JSONField(default=list)
    # D. Instructions
    instructions = models.TextField(blank=True)
    delays = models.TextField(blank=True)
    safety_remarks = models.TextField(blank=True)
    next_day_plan = models.TextField(blank=True)

    class Meta(BaseReport.Meta):
        verbose_name = 'Foreman Daily Report'


class ForemanWeeklyReport(BaseReport):
    week_no = models.CharField(max_length=20)
    period_from = models.DateField()
    period_to = models.DateField()
    # A. Labour summary — {skilled: {mon:0,tue:0,...,total:0}, semi_skilled:{...}, ...}
    labour_summary = models.JSONField(default=dict)
    # B. Works executed — [{no, location, description, unit, weekly_target, weekly_achieved, remarks}]
    works_executed = models.JSONField(default=list)
    # C.
    materials = models.TextField(blank=True)
    major_issues = models.TextField(blank=True)
    safety_summary = models.TextField(blank=True)
    next_week_plan = models.TextField(blank=True)

    class Meta(BaseReport.Meta):
        verbose_name = 'Foreman Weekly Report'


class SurveyorDailyReport(BaseReport):
    date = models.DateField()
    day = models.CharField(max_length=20, blank=True)
    weather = models.CharField(max_length=100, blank=True)
    # A. Team
    surveyor_name = models.CharField(max_length=100, blank=True)
    assistant = models.CharField(max_length=100, blank=True)
    rtk_gps = models.CharField(max_length=100, blank=True)
    total_station = models.CharField(max_length=100, blank=True)
    auto_dumpy_level = models.CharField(max_length=100, blank=True)
    staff_prism = models.CharField(max_length=100, blank=True)
    vehicle_access = models.CharField(max_length=100, blank=True)
    battery_calibration = models.CharField(max_length=100, blank=True)
    # B. Survey activities — [{no, location, activity, output, remarks}]
    survey_activities = models.JSONField(default=list)
    # C. Control points — [{point_id, easting, northing, level, status}]
    control_points = models.JSONField(default=list)
    # D. Issues
    issues = models.TextField(blank=True)
    instructions = models.TextField(blank=True)
    next_day_plan = models.TextField(blank=True)

    class Meta(BaseReport.Meta):
        verbose_name = 'Surveyor Daily Report'


class SurveyorWeeklyReport(BaseReport):
    week_no = models.CharField(max_length=20)
    period_from = models.DateField()
    period_to = models.DateField()
    # A. Weekly activities — [{day, activity, location, output, remarks}] (7 rows Mon-Sun)
    weekly_activities = models.JSONField(default=list)
    # B. Benchmark summary — [{item, status_this_week, action_required, remarks}]
    benchmark_summary = models.JSONField(default=list)
    # C.
    equipment_condition = models.TextField(blank=True)
    challenges = models.TextField(blank=True)
    next_week_plan = models.TextField(blank=True)

    class Meta(BaseReport.Meta):
        verbose_name = 'Surveyor Weekly Report'


class MachineDailyReport(BaseReport):
    date = models.DateField()
    day = models.CharField(max_length=20, blank=True)
    weather = models.CharField(max_length=100, blank=True)
    # A. Machine details
    machine_name = models.CharField(max_length=100, blank=True)
    machine_id = models.CharField(max_length=100, blank=True)
    machine_type = models.CharField(max_length=100, blank=True)
    operator_name = models.CharField(max_length=100, blank=True)
    fuel_type = models.CharField(max_length=50, blank=True)
    operator_licence = models.CharField(max_length=100, blank=True)
    # B. Hours
    start_time = models.CharField(max_length=10, blank=True)
    end_time = models.CharField(max_length=10, blank=True)
    hrs_worked = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    hrs_idle_breakdown = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    total_hrs_on_site = models.DecimalField(max_digits=6, decimal_places=2, default=0)
    # C. Fuel
    opening_meter = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    closing_meter = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    fuel_added = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    oil_fluids_added = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    fuel_balance = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    # D. Work activities — [{no, location, description, unit_qty, remarks}]
    work_activities = models.JSONField(default=list)
    # E. Maintenance — [{item, status, remarks}]
    maintenance_checks = models.JSONField(default=list)
    # F. Breakdowns — [{description, time_down, action_taken, resumed}]
    breakdowns = models.JSONField(default=list)
    # G. Instructions
    instructions = models.TextField(blank=True)
    delays = models.TextField(blank=True)
    safety_remarks = models.TextField(blank=True)
    next_day_plan = models.TextField(blank=True)

    class Meta(BaseReport.Meta):
        verbose_name = 'Machine Daily Report'


class MachineWeeklyReport(BaseReport):
    week_no = models.CharField(max_length=20)
    period_from = models.DateField()
    period_to = models.DateField()
    machine_name = models.CharField(max_length=100, blank=True)
    machine_id = models.CharField(max_length=100, blank=True)
    machine_type = models.CharField(max_length=100, blank=True)
    primary_operator = models.CharField(max_length=100, blank=True)
    opening_meter = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    closing_meter = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_fuel_added = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    total_oil_added = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    # B. Hours summary — {hours_worked:{mon:0,...,total:0}, hours_idle:{...}, hrs_breakdown:{...}, hrs_standby:{...}, fuel_used:{...}}
    hours_summary = models.JSONField(default=dict)
    # D. Works executed — [{no, location, description, unit, weekly_target, weekly_achieved}]
    works_executed = models.JSONField(default=list)
    # E. Maintenance — [{item, scheduled, completed, remarks}]
    maintenance_summary = models.JSONField(default=list)
    # F. Breakdowns — [{day, description, hrs_lost, action_taken}]
    breakdowns = models.JSONField(default=list)
    materials = models.TextField(blank=True)
    major_issues = models.TextField(blank=True)
    safety_summary = models.TextField(blank=True)
    next_week_plan = models.TextField(blank=True)

    class Meta(BaseReport.Meta):
        verbose_name = 'Machine Weekly Report'


def site_photo_upload_path(instance, filename):
    return f"site_photos/{instance.project_name}/{filename}"


class SitePhoto(models.Model):
    CATEGORY_CHOICES = [
        ('general',    'General'),
        ('progress',   'Work Progress'),
        ('issue',      'Issue / Problem'),
        ('safety',     'Safety'),
        ('material',   'Material Delivery'),
        ('equipment',  'Equipment'),
        ('completion', 'Completion'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project_name = models.CharField(max_length=200)
    project_id = models.UUIDField(null=True, blank=True, db_index=True)
    date = models.DateField()
    image = models.ImageField(upload_to=site_photo_upload_path)
    caption = models.CharField(max_length=300, blank=True, default='')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='general')
    location_note = models.CharField(max_length=200, blank=True, default='')
    report_type = models.CharField(max_length=50, blank=True, default='')
    report_id = models.UUIDField(null=True, blank=True)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='site_photos')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.project_name} — {self.date} — {self.caption or 'photo'}"
