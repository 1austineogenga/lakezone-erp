from django.core.management.base import BaseCommand
from django.utils import timezone
from decimal import Decimal
from datetime import date
from projects.models import (
    Project, BOQ, BOQBill, BOQItem,
    Budget, BudgetLineItem,
    IPC, ProjectRisk, ProjectPersonnel, WeeklyProgress
)


class Command(BaseCommand):
    help = 'Seed MN and NS road construction projects with actual workbook data'

    def handle(self, *args, **kwargs):
        self.stdout.write('Seeding MN and NS projects...')

        # ── MN Project ─────────────────────────────────────────────────────────
        mn, _ = Project.objects.update_or_create(
            code='MN',
            defaults=dict(
                name='Magumu - Njambini Road Improvement Project',
                client='Kenya Rural Roads Authority (KeRRA)',
                contract_number='KeRRA/RMLF/015/2024-2025',
                contract_value=Decimal('48500000.00'),
                location='Magumu – Njambini, Nyandarua County',
                latitude=Decimal('-0.7127'),
                longitude=Decimal('36.7263'),
                description=(
                    'Improvement of Magumu–Njambini road covering approximately 12 km. '
                    'Works include grading, gravelling, drainage structures, culvert installation '
                    'and roadside furniture. Funded under the Road Maintenance Levy Fund (RMLF).'
                ),
                start_date=date(2026, 6, 23),
                end_date=date(2026, 8, 15),
                status='active',
            )
        )
        self.stdout.write(f'  ✓ Project MN: {mn.name}')

        # MN BOQ
        mn_boq = BOQ.objects.filter(project=mn).first()
        if not mn_boq:
            mn_boq = BOQ.objects.create(
                project=mn, title='MN BOQ Rev 1 – Magumu-Njambini',
                notes='Tender BOQ as per KeRRA schedule of quantities',
                contingency_pct=Decimal('10.00'), vop_pct=Decimal('10.00'),
            )
        self._seed_mn_boq(mn_boq)

        # MN Budget
        mn_budget = Budget.objects.filter(project=mn).first()
        if not mn_budget:
            mn_budget = Budget.objects.create(
                project=mn, title='MN 2-Month Execution Budget',
                period_weeks=8, status='approved',
                notes='Base case budget for Weeks 1–8. High/Low case variance ±15%/±10%',
            )
        self._seed_mn_budget(mn_budget)

        # MN Personnel
        self._seed_mn_personnel(mn)

        # MN Risks
        self._seed_mn_risks(mn)

        # MN Weekly Progress (Week 1 plan)
        self._seed_mn_progress(mn)

        # ── NS Project ─────────────────────────────────────────────────────────
        ns, _ = Project.objects.update_or_create(
            code='NS',
            defaults=dict(
                name='Njambini - Sasumua Dam Road Improvement Project',
                client='Kenya Rural Roads Authority (KeRRA)',
                contract_number='KeRRA/RMLF/016/2024-2025',
                contract_value=Decimal('62750000.00'),
                location='Njambini – Sasumua Dam, Nyandarua County',
                latitude=Decimal('-0.7512'),
                longitude=Decimal('36.6834'),
                description=(
                    'Improvement of Njambini–Sasumua Dam road covering approximately 16 km. '
                    'Works include grading, gravelling, drainage, culverts and structures. '
                    'Funded under the Road Maintenance Levy Fund (RMLF).'
                ),
                start_date=date(2026, 6, 23),
                end_date=date(2026, 8, 29),
                status='active',
            )
        )
        self.stdout.write(f'  ✓ Project NS: {ns.name}')

        # NS BOQ
        ns_boq = BOQ.objects.filter(project=ns).first()
        if not ns_boq:
            ns_boq = BOQ.objects.create(
                project=ns, title='NS BOQ Rev 1 – Njambini-Sasumua',
                notes='Tender BOQ – Njabini-Sasumua Dam Road (KeRRA Schedule of Quantities)',
                contingency_pct=Decimal('10.00'), vop_pct=Decimal('10.00'),
            )
        self._seed_ns_boq(ns_boq)

        # NS Budget
        ns_budget = Budget.objects.filter(project=ns).first()
        if not ns_budget:
            ns_budget = Budget.objects.create(
                project=ns, title='NS 2-Month Execution Budget',
                period_weeks=8, status='approved',
                notes='Base case budget for Weeks 1–8. High/Low case variance ±15%/±10%',
            )
        self._seed_ns_budget(ns_budget)

        # NS Personnel
        self._seed_ns_personnel(ns)

        # NS Risks
        self._seed_ns_risks(ns)

        # NS Weekly Progress
        self._seed_ns_progress(ns)

        self.stdout.write(self.style.SUCCESS('\nDone! MN and NS projects seeded successfully.'))

    # ── MN BOQ ─────────────────────────────────────────────────────────────────
    def _seed_mn_boq(self, boq):
        BOQItem.objects.filter(bill__boq=boq).delete()
        BOQBill.objects.filter(boq=boq).delete()

        bills = [
            ('1', 'Preliminary and General', 0, [
                ('1.1', 'Mobilisation and demobilisation', 'Sum', Decimal('1'), Decimal('850000'), Decimal('850000')),
                ('1.2', 'Traffic management and safety', 'Sum', Decimal('1'), Decimal('320000'), Decimal('320000')),
                ('1.3', 'Site establishment and offices', 'Sum', Decimal('1'), Decimal('180000'), Decimal('180000')),
                ('1.4', 'Environmental management plan', 'Sum', Decimal('1'), Decimal('95000'), Decimal('95000')),
            ]),
            ('4', 'Site Clearance', 1, [
                ('4.1', 'Clearing and grubbing – bush and scrub', 'Ha', Decimal('8.40'), Decimal('45000'), Decimal('378000')),
                ('4.2', 'Removal of trees (girth 0.5–1.0 m)', 'No', Decimal('12'), Decimal('8500'), Decimal('102000')),
                ('4.3', 'Removal of obstructions and old structures', 'Sum', Decimal('1'), Decimal('120000'), Decimal('120000')),
            ]),
            ('5', 'Earthworks', 2, [
                ('5.1', 'Formation cut to spoil (soft material)', 'm³', Decimal('4200'), Decimal('380'), Decimal('1596000')),
                ('5.2', 'Formation cut to spoil (hard material)', 'm³', Decimal('1800'), Decimal('620'), Decimal('1116000')),
                ('5.3', 'Fill from borrow (approved material)', 'm³', Decimal('6500'), Decimal('450'), Decimal('2925000')),
                ('5.4', 'Compaction of subgrade to 95% MDD', 'm²', Decimal('36000'), Decimal('85'), Decimal('3060000')),
                ('5.5', 'Trimming and shaping of formation', 'm²', Decimal('36000'), Decimal('42'), Decimal('1512000')),
            ]),
            ('7', 'Gravel Wearing Course', 3, [
                ('7.1', 'Supply and place gravel wearing course (150mm compacted)', 'm³', Decimal('5400'), Decimal('2200'), Decimal('11880000')),
                ('7.2', 'Scarify and re-compact existing gravel (100mm)', 'm²', Decimal('18000'), Decimal('120'), Decimal('2160000')),
            ]),
            ('8', 'Drainage Works', 4, [
                ('8.1', 'Excavation for drains (soft material)', 'm³', Decimal('2800'), Decimal('320'), Decimal('896000')),
                ('8.2', 'Side drain – stone pitched (0.6m wide × 0.4m deep)', 'lm', Decimal('4200'), Decimal('1850'), Decimal('7770000')),
                ('8.3', 'Mitre drains (formed and shaped)', 'No', Decimal('85'), Decimal('3500'), Decimal('297500')),
                ('8.4', 'Silt traps (masonry)', 'No', Decimal('30'), Decimal('18000'), Decimal('540000')),
                ('8.5', 'Outlet protection (stone pitching)', 'm²', Decimal('420'), Decimal('2800'), Decimal('1176000')),
            ]),
            ('9', 'Culverts', 5, [
                ('9.1', 'Supply & install 600mm dia CMP culvert', 'lm', Decimal('180'), Decimal('12500'), Decimal('2250000')),
                ('9.2', 'Supply & install 900mm dia CMP culvert', 'lm', Decimal('64'), Decimal('18500'), Decimal('1184000')),
                ('9.3', 'Headwalls and wingwalls (plain concrete)', 'm³', Decimal('48'), Decimal('28000'), Decimal('1344000')),
                ('9.4', 'Bedding (class G5 material)', 'm³', Decimal('95'), Decimal('4500'), Decimal('427500')),
            ]),
        ]
        for bill_no, desc, order, items in bills:
            sub = sum(a for _, _, _, _, _, a in items)
            bill = BOQBill.objects.create(boq=boq, bill_number=bill_no, description=desc, order=order, sub_total=sub)
            for item_no, idesc, unit, qty, rate, amount in items:
                BOQItem.objects.create(bill=bill, item_number=item_no, description=idesc, unit=unit, quantity=qty, rate=rate, amount=amount)
        self.stdout.write(f'    ✓ MN BOQ: {len(bills)} bills seeded')

    # ── MN Budget ──────────────────────────────────────────────────────────────
    def _seed_mn_budget(self, budget):
        BudgetLineItem.objects.filter(budget=budget).delete()

        items = [
            # week, category, description, qty, unit, base_rate, waste%, low%, high%
            # Week 1
            (1, 'fuel',      'Diesel – Motor Grader (Cat 140G)',           1200, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (1, 'fuel',      'Diesel – Compactor (Bomag BW213)',            480, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (1, 'fuel',      'Diesel – Water Bowser (10,000L)',             320, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (1, 'fuel',      'Diesel – Tipper Trucks (×4)',                 960, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (1, 'labour',    'Site Engineer (monthly prorate)',               1, 'Week',   Decimal('45000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (1, 'labour',    'General Foreman',                              1, 'Week',   Decimal('22000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (1, 'labour',    'Surveyor',                                     1, 'Week',   Decimal('28000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (1, 'casuals',   'Bush clearing casuals (20 persons × 5 days)', 100, 'ManDays', Decimal('800'), Decimal('0'), Decimal('10'), Decimal('20')),
            (1, 'materials', 'Survey pegs and marking stakes',               1, 'Lot',    Decimal('15000'), Decimal('10'), Decimal('5'), Decimal('10')),
            # Week 2
            (2, 'fuel',      'Diesel – Motor Grader (Cat 140G)',           1200, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (2, 'fuel',      'Diesel – Compactor (Bomag BW213)',            480, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (2, 'fuel',      'Diesel – Water Bowser',                       320, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (2, 'fuel',      'Diesel – Tipper Trucks (×4)',                 960, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (2, 'labour',    'Site Engineer',                                1, 'Week',   Decimal('45000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (2, 'labour',    'General Foreman',                              1, 'Week',   Decimal('22000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (2, 'labour',    'Surveyor',                                     1, 'Week',   Decimal('28000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (2, 'casuals',   'Earthworks casuals (25 persons × 5 days)',   125, 'ManDays', Decimal('800'), Decimal('0'), Decimal('10'), Decimal('20')),
            (2, 'materials', 'Culvert pipes 600mm CMP (30 lm)',              1, 'Lot',    Decimal('375000'), Decimal('5'), Decimal('5'), Decimal('12')),
            # Week 3
            (3, 'fuel',      'Diesel – Motor Grader',                     1200, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (3, 'fuel',      'Diesel – Compactor',                         480, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (3, 'fuel',      'Diesel – Water Bowser',                      320, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (3, 'fuel',      'Diesel – Tippers (×4)',                       960, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (3, 'labour',    'Site Engineer',                                1, 'Week',   Decimal('45000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (3, 'labour',    'General Foreman',                              1, 'Week',   Decimal('22000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (3, 'casuals',   'Drainage casuals (30 persons × 5 days)',     150, 'ManDays', Decimal('800'), Decimal('0'), Decimal('10'), Decimal('20')),
            (3, 'materials', 'Quarry stone – pitching (200 tonnes)',         1, 'Lot',    Decimal('320000'), Decimal('8'), Decimal('5'), Decimal('15')),
            (3, 'materials', 'Cement (50 bags @ KES 1,100)',                 1, 'Lot',    Decimal('55000'), Decimal('10'), Decimal('5'), Decimal('12')),
            # Week 4
            (4, 'fuel',      'Diesel – Motor Grader',                     1200, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (4, 'fuel',      'Diesel – Compactor',                         480, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (4, 'fuel',      'Diesel – Water Bowser',                      320, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (4, 'fuel',      'Diesel – Tippers (×4)',                       960, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (4, 'labour',    'Site Engineer',                                1, 'Week',   Decimal('45000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (4, 'labour',    'General Foreman',                              1, 'Week',   Decimal('22000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (4, 'labour',    'Surveyor',                                     1, 'Week',   Decimal('28000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (4, 'casuals',   'Gravelling casuals (35 persons × 5 days)',   175, 'ManDays', Decimal('800'), Decimal('0'), Decimal('10'), Decimal('20')),
            (4, 'materials', 'Gravel from borrow pit (1,200 m³)',            1, 'Lot',    Decimal('1080000'), Decimal('10'), Decimal('8'), Decimal('15')),
            # Week 5-8 (months 2)
            (5, 'fuel',      'Diesel – all plant',                        2960, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (5, 'labour',    'Site Engineer + Foreman + Surveyor',           1, 'Week',   Decimal('95000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (5, 'casuals',   'Gravelling casuals (35 persons × 5 days)',   175, 'ManDays', Decimal('800'), Decimal('0'), Decimal('10'), Decimal('20')),
            (5, 'materials', 'Gravel from borrow pit (1,350 m³)',            1, 'Lot',    Decimal('1215000'), Decimal('10'), Decimal('8'), Decimal('15')),
            (6, 'fuel',      'Diesel – all plant',                        2960, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (6, 'labour',    'Site Engineer + Foreman + Surveyor',           1, 'Week',   Decimal('95000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (6, 'casuals',   'Drainage/finishing casuals (30 × 5 days)',   150, 'ManDays', Decimal('800'), Decimal('0'), Decimal('10'), Decimal('20')),
            (6, 'materials', 'Headwall concrete and formwork',               1, 'Lot',    Decimal('280000'), Decimal('8'), Decimal('5'), Decimal('12')),
            (7, 'fuel',      'Diesel – all plant',                        2400, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (7, 'labour',    'Site Engineer + Foreman',                      1, 'Week',   Decimal('67000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (7, 'casuals',   'Finishing and snagging casuals (20 × 5)',    100, 'ManDays', Decimal('800'), Decimal('0'), Decimal('10'), Decimal('20')),
            (7, 'materials', 'Road furniture – signs and markers',           1, 'Lot',    Decimal('185000'), Decimal('5'), Decimal('5'), Decimal('10')),
            (8, 'fuel',      'Diesel – all plant (demob week)',            1200, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (8, 'labour',    'Site Engineer + Foreman',                      1, 'Week',   Decimal('67000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (8, 'casuals',   'Demobilisation casuals (10 × 3 days)',        30, 'ManDays', Decimal('800'), Decimal('0'), Decimal('5'), Decimal('10')),
            (8, 'management','Contingency reserve (5%)',                      1, 'Lot',   Decimal('480000'), Decimal('0'), Decimal('0'), Decimal('0')),
        ]
        self._create_budget_items(budget, items)
        self.stdout.write(f'    ✓ MN Budget: {len(items)} line items seeded')

    # ── MN Personnel ───────────────────────────────────────────────────────────
    def _seed_mn_personnel(self, project):
        ProjectPersonnel.objects.filter(project=project).delete()
        personnel = [
            ('James Mwangi Kariuki', 'site_engineer', date(2026, 6, 23), None, Decimal('85000'), True, 'Lead SE – responsible for daily site supervision and QA'),
            ('Peter Njoroge Kamau', 'general_foreman', date(2026, 6, 23), None, Decimal('42000'), True, 'GF – manages labour gangs and plant deployment'),
            ('Catherine Wanjiku Ndung\'u', 'surveyor', date(2026, 6, 23), None, Decimal('55000'), True, 'Sets out road alignment, checks levels and quantities'),
            ('Samuel Ochieng Otieno', 'hse_lead', date(2026, 6, 23), None, Decimal('38000'), True, 'HSE officer – toolbox talks, PPE, incident reporting'),
            ('Grace Njeri Muthoni', 'clerk', date(2026, 6, 23), None, Decimal('28000'), True, 'Site clerk – site diary, material records, timesheets'),
        ]
        for name, role, start, end, rate, inc, notes in personnel:
            ProjectPersonnel.objects.create(
                project=project, employee_name=name, role=role,
                start_date=start, end_date=end, monthly_rate=rate,
                include_in_budget=inc, notes=notes,
            )

    # ── MN Risks ───────────────────────────────────────────────────────────────
    def _seed_mn_risks(self, project):
        ProjectRisk.objects.filter(project=project).delete()
        risks = [
            ('Prolonged rainfall causing work stoppages and road surface damage',
             'Delays of 1–3 weeks; increased material wastage and rework costs',
             'KES 350,000 contingency allocation in budget; programme float of 1 week',
             'KES 200K – KES 600K', 'Site Engineer', 'high', 'open'),
            ('Borrow pit material fails CBR test on site',
             'Gravel rejection, additional haulage cost and programme delay',
             'KES 180,000 reserve; alternative borrow pit identified at Njabini quarry',
             'KES 100K – KES 300K', 'Surveyor', 'medium', 'open'),
            ('Fuel price increase above 10%',
             'Budget overrun on plant and equipment costs',
             'Fuel price escalation clause in BoQ; 15% high-case variance provisioned',
             'KES 80K – KES 200K', 'Site Engineer', 'medium', 'open'),
            ('Community disruption / land access disputes',
             'Work stoppage on affected chainage; possible client involvement',
             'Early stakeholder engagement; client to issue access letters before mobilisation',
             'KES 50K – KES 500K', 'General Foreman', 'high', 'open'),
            ('Equipment breakdown (grader or compactor)',
             'Production loss of 2–5 days; hiring of standby equipment',
             'KES 120,000 provisional for equipment hire; preventive maintenance schedule in place',
             'KES 60K – KES 200K', 'General Foreman', 'medium', 'open'),
        ]
        for desc, impact, treatment, rng, owner, level, status in risks:
            ProjectRisk.objects.create(
                project=project, risk_description=desc, expected_impact=impact,
                budget_treatment=treatment, realistic_range=rng, owner=owner,
                impact_level=level, status=status,
            )

    # ── MN Weekly Progress ────────────────────────────────────────────────────
    def _seed_mn_progress(self, project):
        WeeklyProgress.objects.filter(project=project).delete()
        WeeklyProgress.objects.create(
            project=project, week_no=1,
            week_start=date(2026, 6, 23), week_end=date(2026, 6, 27),
            work_focus='Site establishment, mobilisation, survey and bush clearing (Ch. 0+000 – 2+500)',
            materials_actual=Decimal('0'), fuel_actual=Decimal('0'),
            labour_actual=Decimal('0'), casuals_actual=Decimal('0'),
            total_actual=Decimal('0'),
            casual_headcount=0, casual_person_days=0,
            progress_notes='Week 1 plan — project starts 23 June 2026. No actuals yet.',
            issues='',
            next_week_plan='Complete mobilisation by 25 June. Begin grading Ch. 0+000 – 1+500 Week 2.',
            submitted_by='', submitted_at=None,
        )

    # ── NS BOQ ─────────────────────────────────────────────────────────────────
    def _seed_ns_boq(self, boq):
        BOQItem.objects.filter(bill__boq=boq).delete()
        BOQBill.objects.filter(boq=boq).delete()

        bills = [
            ('1', 'Preliminary and General', 0, [
                ('1.1', 'Mobilisation and demobilisation', 'Sum', Decimal('1'), Decimal('1100000'), Decimal('1100000')),
                ('1.2', 'Traffic management and road safety', 'Sum', Decimal('1'), Decimal('420000'), Decimal('420000')),
                ('1.3', 'Site offices and facilities', 'Sum', Decimal('1'), Decimal('220000'), Decimal('220000')),
                ('1.4', 'Environmental and social safeguards', 'Sum', Decimal('1'), Decimal('145000'), Decimal('145000')),
                ('1.5', 'As-built drawings and project close-out', 'Sum', Decimal('1'), Decimal('85000'), Decimal('85000')),
            ]),
            ('4', 'Site Clearance', 1, [
                ('4.1', 'Clearing and grubbing (bush and scrub)', 'Ha', Decimal('11.20'), Decimal('45000'), Decimal('504000')),
                ('4.2', 'Removal of trees (girth >0.5m)', 'No', Decimal('18'), Decimal('9000'), Decimal('162000')),
                ('4.3', 'Demolition and removal of obstructions', 'Sum', Decimal('1'), Decimal('95000'), Decimal('95000')),
            ]),
            ('5', 'Earthworks', 2, [
                ('5.1', 'Cut to spoil – soft material', 'm³', Decimal('5800'), Decimal('380'), Decimal('2204000')),
                ('5.2', 'Cut to spoil – hard material (rock)', 'm³', Decimal('2200'), Decimal('850'), Decimal('1870000')),
                ('5.3', 'Fill from borrow (class G7 material)', 'm³', Decimal('9500'), Decimal('450'), Decimal('4275000')),
                ('5.4', 'Subgrade compaction to 95% MDD', 'm²', Decimal('48000'), Decimal('85'), Decimal('4080000')),
                ('5.5', 'Trimming and shaping formation', 'm²', Decimal('48000'), Decimal('42'), Decimal('2016000')),
            ]),
            ('7', 'Gravel Wearing Course', 3, [
                ('7.1', 'Supply and place gravel wearing course 150mm compacted', 'm³', Decimal('7200'), Decimal('2200'), Decimal('15840000')),
                ('7.2', 'Scarify and re-compact existing gravel 100mm', 'm²', Decimal('22000'), Decimal('120'), Decimal('2640000')),
                ('7.3', 'Regravelling at failed sections (selected)', 'm³', Decimal('800'), Decimal('2400'), Decimal('1920000')),
            ]),
            ('8', 'Drainage Works', 4, [
                ('8.1', 'Excavation for drains', 'm³', Decimal('3800'), Decimal('320'), Decimal('1216000')),
                ('8.2', 'Stone pitched side drain (0.6m × 0.4m)', 'lm', Decimal('5800'), Decimal('1850'), Decimal('10730000')),
                ('8.3', 'V-shaped earth drain (formed)', 'lm', Decimal('2400'), Decimal('380'), Decimal('912000')),
                ('8.4', 'Mitre drains', 'No', Decimal('110'), Decimal('3500'), Decimal('385000')),
                ('8.5', 'Silt traps (masonry, 1.0m × 1.0m × 1.2m)', 'No', Decimal('42'), Decimal('18000'), Decimal('756000')),
                ('8.6', 'Outlet protection (stone pitching)', 'm²', Decimal('580'), Decimal('2800'), Decimal('1624000')),
            ]),
            ('9', 'Culverts', 5, [
                ('9.1', 'Supply and install 600mm dia CMP culvert', 'lm', Decimal('240'), Decimal('12500'), Decimal('3000000')),
                ('9.2', 'Supply and install 900mm dia CMP culvert', 'lm', Decimal('96'), Decimal('18500'), Decimal('1776000')),
                ('9.3', 'Supply and install 1200mm dia CMP culvert', 'lm', Decimal('32'), Decimal('26000'), Decimal('832000')),
                ('9.4', 'Headwalls and wingwalls (plain concrete 1:3:6)', 'm³', Decimal('72'), Decimal('28000'), Decimal('2016000')),
                ('9.5', 'Bedding material (G5)', 'm³', Decimal('140'), Decimal('4500'), Decimal('630000')),
                ('9.6', 'Rock fill protection at outlets', 'm³', Decimal('85'), Decimal('3800'), Decimal('323000')),
            ]),
            ('12', 'Structures – Drifts and Drifts', 6, [
                ('12.1', 'Excavation for drift foundations', 'm³', Decimal('280'), Decimal('650'), Decimal('182000')),
                ('12.2', 'Plain concrete foundations (1:3:6)', 'm³', Decimal('95'), Decimal('32000'), Decimal('3040000')),
                ('12.3', 'Reinforced concrete apron slab', 'm³', Decimal('45'), Decimal('55000'), Decimal('2475000')),
                ('12.4', 'Stone masonry wingwalls', 'm³', Decimal('60'), Decimal('22000'), Decimal('1320000')),
            ]),
            ('14', 'Road Furniture and Finishing', 7, [
                ('14.1', 'Km posts (concrete)', 'No', Decimal('16'), Decimal('4500'), Decimal('72000')),
                ('14.2', 'Warning signs (class 1 reflective)', 'No', Decimal('24'), Decimal('12000'), Decimal('288000')),
                ('14.3', 'Speed limit signs', 'No', Decimal('12'), Decimal('9500'), Decimal('114000')),
                ('14.4', 'Guide posts (delineators)', 'No', Decimal('80'), Decimal('2200'), Decimal('176000')),
                ('14.5', 'Painting of kerbs (where applicable)', 'lm', Decimal('320'), Decimal('850'), Decimal('272000')),
            ]),
        ]
        for bill_no, desc, order, items in bills:
            sub = sum(a for _, _, _, _, _, a in items)
            bill = BOQBill.objects.create(boq=boq, bill_number=bill_no, description=desc, order=order, sub_total=sub)
            for item_no, idesc, unit, qty, rate, amount in items:
                BOQItem.objects.create(bill=bill, item_number=item_no, description=idesc, unit=unit, quantity=qty, rate=rate, amount=amount)
        self.stdout.write(f'    ✓ NS BOQ: {len(bills)} bills seeded')

    # ── NS Budget ──────────────────────────────────────────────────────────────
    def _seed_ns_budget(self, budget):
        BudgetLineItem.objects.filter(budget=budget).delete()

        items = [
            # Week 1
            (1, 'fuel',      'Diesel – Motor Grader (Cat 140G)',           1200, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (1, 'fuel',      'Diesel – Compactor (Bomag BW213)',            480, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (1, 'fuel',      'Diesel – Water Bowser',                       320, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (1, 'fuel',      'Diesel – Tipper Trucks (×5)',                1200, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (1, 'fuel',      'Diesel – Excavator (JCB JS205)',              640, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (1, 'labour',    'Site Engineer',                                 1, 'Week',   Decimal('45000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (1, 'labour',    'General Foreman',                               1, 'Week',   Decimal('22000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (1, 'labour',    'Surveyor',                                      1, 'Week',   Decimal('28000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (1, 'labour',    'HSE Lead',                                      1, 'Week',   Decimal('18000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (1, 'casuals',   'Bush clearing casuals (25 × 5 days)',         125, 'ManDays', Decimal('800'), Decimal('0'), Decimal('10'), Decimal('20')),
            (1, 'materials', 'Survey consumables and pegs',                   1, 'Lot',   Decimal('18000'), Decimal('10'), Decimal('5'), Decimal('10')),
            # Week 2
            (2, 'fuel',      'Diesel – all plant (grader, compactor, bowser, tippers, excavator)', 3840, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (2, 'labour',    'Site Engineer + GF + Surveyor + HSE',           1, 'Week',  Decimal('113000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (2, 'casuals',   'Earthworks casuals (30 × 5 days)',            150, 'ManDays', Decimal('800'), Decimal('0'), Decimal('10'), Decimal('20')),
            (2, 'materials', 'Culvert pipes 600mm CMP (40 lm)',               1, 'Lot',   Decimal('500000'), Decimal('5'), Decimal('5'), Decimal('12')),
            (2, 'materials', 'Culvert pipes 900mm CMP (20 lm)',               1, 'Lot',   Decimal('370000'), Decimal('5'), Decimal('5'), Decimal('12')),
            # Week 3
            (3, 'fuel',      'Diesel – all plant',                         3840, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (3, 'labour',    'Site Engineer + GF + Surveyor + HSE',           1, 'Week',  Decimal('113000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (3, 'casuals',   'Drainage casuals (35 × 5 days)',              175, 'ManDays', Decimal('800'), Decimal('0'), Decimal('10'), Decimal('20')),
            (3, 'materials', 'Quarry stone – pitched drains (280 tonnes)',    1, 'Lot',   Decimal('448000'), Decimal('8'), Decimal('5'), Decimal('15')),
            (3, 'materials', 'Cement (80 bags @ KES 1,100)',                  1, 'Lot',   Decimal('88000'), Decimal('10'), Decimal('5'), Decimal('12')),
            (3, 'materials', 'Sand (15 m³)',                                  1, 'Lot',   Decimal('37500'), Decimal('10'), Decimal('5'), Decimal('12')),
            # Week 4
            (4, 'fuel',      'Diesel – all plant',                         3840, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (4, 'labour',    'Site Engineer + GF + Surveyor + HSE',           1, 'Week',  Decimal('113000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (4, 'casuals',   'Gravelling casuals (40 × 5 days)',            200, 'ManDays', Decimal('800'), Decimal('0'), Decimal('10'), Decimal('20')),
            (4, 'materials', 'Gravel – borrow pit (1,500 m³)',                1, 'Lot',   Decimal('1350000'), Decimal('10'), Decimal('8'), Decimal('15')),
            # Week 5
            (5, 'fuel',      'Diesel – all plant',                         3840, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (5, 'labour',    'Site Engineer + GF + Surveyor + HSE',           1, 'Week',  Decimal('113000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (5, 'casuals',   'Gravelling casuals (40 × 5 days)',            200, 'ManDays', Decimal('800'), Decimal('0'), Decimal('10'), Decimal('20')),
            (5, 'materials', 'Gravel – borrow pit (1,800 m³)',                1, 'Lot',   Decimal('1620000'), Decimal('10'), Decimal('8'), Decimal('15')),
            # Week 6
            (6, 'fuel',      'Diesel – all plant',                         3840, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (6, 'labour',    'Site Engineer + GF + Surveyor + HSE',           1, 'Week',  Decimal('113000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (6, 'casuals',   'Structures and drainage casuals (35 × 5)',    175, 'ManDays', Decimal('800'), Decimal('0'), Decimal('10'), Decimal('20')),
            (6, 'materials', 'Concrete for headwalls and drifts',             1, 'Lot',   Decimal('680000'), Decimal('8'), Decimal('5'), Decimal('12')),
            (6, 'materials', 'Reinforcement steel (1.5 tonnes)',               1, 'Lot',   Decimal('225000'), Decimal('5'), Decimal('5'), Decimal('10')),
            # Week 7
            (7, 'fuel',      'Diesel – all plant',                         3200, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (7, 'labour',    'Site Engineer + GF + Surveyor',                  1, 'Week',  Decimal('95000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (7, 'casuals',   'Finishing and furniture casuals (25 × 5)',    125, 'ManDays', Decimal('800'), Decimal('0'), Decimal('10'), Decimal('20')),
            (7, 'materials', 'Road signs and furniture',                       1, 'Lot',   Decimal('320000'), Decimal('5'), Decimal('5'), Decimal('10')),
            # Week 8
            (8, 'fuel',      'Diesel – demob week',                        1600, 'Litres', Decimal('165'), Decimal('5'), Decimal('8'), Decimal('15')),
            (8, 'labour',    'Site Engineer + GF',                             1, 'Week',   Decimal('67000'), Decimal('0'), Decimal('0'), Decimal('0')),
            (8, 'casuals',   'Demob and clean-up casuals (15 × 3 days)',    45, 'ManDays', Decimal('800'), Decimal('0'), Decimal('5'), Decimal('10')),
            (8, 'management','Contingency reserve (5%)',                        1, 'Lot',  Decimal('620000'), Decimal('0'), Decimal('0'), Decimal('0')),
        ]
        self._create_budget_items(budget, items)
        self.stdout.write(f'    ✓ NS Budget: {len(items)} line items seeded')

    # ── NS Personnel ───────────────────────────────────────────────────────────
    def _seed_ns_personnel(self, project):
        ProjectPersonnel.objects.filter(project=project).delete()
        personnel = [
            ('David Kimani Njoroge', 'site_engineer', date(2026, 6, 23), None, Decimal('85000'), True, 'Lead SE – NS project'),
            ('Joseph Waweru Maina', 'general_foreman', date(2026, 6, 23), None, Decimal('42000'), True, 'GF – NS project'),
            ('Alice Njoki Kamau', 'surveyor', date(2026, 6, 23), None, Decimal('55000'), True, 'Surveyor – alignment and quantities'),
            ('Robert Kipchoge Mutai', 'hse_lead', date(2026, 6, 23), None, Decimal('38000'), True, 'HSE officer'),
            ('Esther Wambui Gitau', 'clerk', date(2026, 6, 23), None, Decimal('28000'), True, 'Site clerk – records and timesheets'),
            ('Francis Muturi Ndegwa', 'foreman', date(2026, 6, 23), None, Decimal('32000'), True, 'Drainage foreman – structures gang'),
        ]
        for name, role, start, end, rate, inc, notes in personnel:
            ProjectPersonnel.objects.create(
                project=project, employee_name=name, role=role,
                start_date=start, end_date=end, monthly_rate=rate,
                include_in_budget=inc, notes=notes,
            )

    # ── NS Risks ───────────────────────────────────────────────────────────────
    def _seed_ns_risks(self, project):
        ProjectRisk.objects.filter(project=project).delete()
        risks = [
            ('High rainfall near Sasumua Dam causing flooding of works',
             'Damage to completed works; programme delays of 2–4 weeks',
             'KES 500,000 contingency; design drainage to cater for 1:10-year storm event',
             'KES 300K – KES 800K', 'Site Engineer', 'critical', 'open'),
            ('Rock encountered in cut sections exceeds tender allowance',
             'Higher unit cost for rock excavation; programme extension',
             'KES 220,000 provisional for additional blasting; early geological investigation',
             'KES 150K – KES 400K', 'Surveyor', 'high', 'open'),
            ('Gravel borrow pit access road impassable in wet season',
             'Haulage delays; higher transport cost per m³',
             'Identify secondary borrow pit closer to road; provision 15% high-case variance',
             'KES 120K – KES 350K', 'General Foreman', 'high', 'open'),
            ('Subcontractor default on culvert supply',
             'Programme delay of 1–2 weeks; emergency procurement required',
             'Two pre-qualified suppliers; 4-week lead time buffer in programme',
             'KES 80K – KES 200K', 'Site Engineer', 'medium', 'open'),
            ('Labour disputes / casual worker unrest',
             'Work stoppage; potential damage to equipment',
             'Fair pay policy; use local workers; stakeholder liaison with area chief',
             'KES 50K – KES 300K', 'HSE Lead', 'medium', 'open'),
            ('Scope creep – client requesting additional drainage works',
             'Budget overrun; programme extension without variation order',
             'Strict scope control; all additions must have signed variation order',
             'KES 200K – KES 1M', 'Site Engineer', 'medium', 'open'),
        ]
        for desc, impact, treatment, rng, owner, level, status in risks:
            ProjectRisk.objects.create(
                project=project, risk_description=desc, expected_impact=impact,
                budget_treatment=treatment, realistic_range=rng, owner=owner,
                impact_level=level, status=status,
            )

    # ── NS Weekly Progress ────────────────────────────────────────────────────
    def _seed_ns_progress(self, project):
        WeeklyProgress.objects.filter(project=project).delete()
        WeeklyProgress.objects.create(
            project=project, week_no=1,
            week_start=date(2026, 6, 23), week_end=date(2026, 6, 27),
            work_focus='Site establishment, mobilisation, topographic survey (Ch. 0+000 – 16+000) and bush clearing (Ch. 0+000 – 3+000)',
            materials_actual=Decimal('0'), fuel_actual=Decimal('0'),
            labour_actual=Decimal('0'), casuals_actual=Decimal('0'),
            total_actual=Decimal('0'),
            casual_headcount=0, casual_person_days=0,
            progress_notes='Week 1 plan — NS project starts 23 June 2026. No actuals yet.',
            issues='',
            next_week_plan='Complete full survey by 26 June. Mobilise all plant to site. Begin grading Ch. 0+000 Week 2.',
            submitted_by='', submitted_at=None,
        )

    # ── Helper ─────────────────────────────────────────────────────────────────
    def _create_budget_items(self, budget, items):
        for week, cat, desc, qty, unit, base_rate, waste, low, high in items:
            qty_d = Decimal(str(qty))
            base = qty_d * base_rate * (1 + waste / 100)
            low_c = base * (1 - low / 100)
            high_c = base * (1 + high / 100)
            BudgetLineItem.objects.create(
                budget=budget, week_no=week, category=cat,
                description=desc, quantity=qty_d, unit=unit,
                base_rate=base_rate,
                waste_allowance_pct=waste, low_variance_pct=low, high_variance_pct=high,
                base_cost=base.quantize(Decimal('0.01')),
                low_case_cost=low_c.quantize(Decimal('0.01')),
                high_case_cost=high_c.quantize(Decimal('0.01')),
                variance_reserve=(high_c - base).quantize(Decimal('0.01')),
            )
