"""
Seed all fleet assets into inventory.Asset (Operations department)
from the Lakezone Complete Fleet Register (June 2026).

Usage:
    python backend/manage.py seed_assets_fleet
    python backend/manage.py seed_assets_fleet --dry-run
"""
from datetime import date, datetime
from django.core.management.base import BaseCommand


def parse_date(val):
    if not val or val in ('—', 'N/A', None):
        return None
    if isinstance(val, (date, datetime)):
        return val.date() if isinstance(val, datetime) else val
    for fmt in ('%d/%m/%Y', '%Y-%m-%d'):
        try:
            return datetime.strptime(str(val), fmt).date()
        except ValueError:
            pass
    return None


def map_status(s):
    if not s:
        return 'operational'
    s = s.strip().lower()
    if 'non-op' in s or 'non_op' in s:
        return 'non_operational'
    if 'functional' in s:
        return 'functional'
    if 'undetermined' in s:
        return 'undetermined'
    if 'repair' in s:
        return 'under_repair'
    return 'operational'


def map_cert(s):
    if not s or s in ('—', 'N/A'):
        return ''
    s = s.strip().lower()
    if 'expired' in s or 'expir' in s:
        return 'expired'
    if 'not in system' in s or 'not_in_system' in s:
        return 'not_in_system'
    if 'valid' in s:
        return 'valid'
    return ''


def map_category(cat):
    c = (cat or '').strip().lower()
    if 'plant' in c or 'machine' in c:
        return 'machinery'
    if c == 'vehicle':
        return 'vehicles'
    return 'trucks_tracks'


class Command(BaseCommand):
    help = 'Seed fleet assets into inventory.Asset (Operations department)'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **options):
        dry = options['dry_run']
        if dry:
            self.stdout.write(self.style.WARNING('DRY RUN — nothing will be saved\n'))

        from inventory.models import Asset

        stats = {'created': 0, 'updated': 0}

        def upsert(asset_code, **kw):
            if dry:
                self.stdout.write(f'  [{asset_code}] {kw.get("name")} — {kw.get("category")}')
                return
            obj, created = Asset.objects.update_or_create(asset_code=asset_code, defaults=kw)
            stats['created' if created else 'updated'] += 1

        # ── SECTION A: PLANT MACHINES ──────────────────────────────────────────
        self.stdout.write('Seeding plant machines ...')

        MACHINES = [
            # (no, reg_id, description, make, model, serial, yom, acquisition,
            #  operator, location, op_status, ins_exp, ins_st, insp_st, sg_exp, sg_st,
            #  defects, requirements)
            (1,  'KHMA 460N',      'Excavator',                      'Jonyang',    'JY625E',     None,                  2023, 2026, 'Francis Kiarie',  'Njambini (South Kinangop)', 'Operational',   None,       '—',      '—',              None,       '—',    'Dented arm hydraulic cylinder with leaking seals; Boom hydraulic cylinder seals leaking; Unprotected undercarriage chassis', 'Welding & fabrication; Engineering for dented cylinder; Wiring for lights. Continuous monitoring needed.'),
            (2,  'N/A',            'Excavator',                      'Caterpillar','323D-2L',    None,                  None, 2026, 'Francis Kiarie',  'Njambini',                  'Operational',   None,       '—',      '—',              None,       '—',    'None reported', 'New acquisition 2026'),
            (3,  'CAT 140G',       'Grader',                         'Caterpillar','140G',       None,                  1994, 2023, 'Abiero Malaki',   'Njambini (South Kinangop)', 'Operational',   None,       '—',      '—',              None,       '—',    'Short-circuited battery post', 'Battery post refilling; Fabrication of engine covers; Lockable battery compartment; Padlocks size 265 (2 pcs)'),
            (4,  'KBG 365F',       'Grader',                         'Caterpillar','140G',       None,                  None, 2025, 'Harun Muriithi',  'Njambini',                  'Non-Operational',None,      '—',      '—',              None,       '—',    'Leaking hydraulic pipe (major); Leaking coolant gasket; Mismatch ripper bar; Worn alternator bearing', 'Gas brazing for hydraulic hose; Coolant gasket replacement; Ripper bar modification; Alternator bearing replacement'),
            (5,  'KHMA 996K',      'Roller - Single Drum',           'XGMA',       'XG6181M-I',  'XG06188L0H110255K',   2017, 2024, 'Patrick Kitheka', 'Njambini (South Kinangop)', 'Operational',   None,       '—',      '—',              None,       '—',    'Defective hour clock', 'Hour clock replacement'),
            (6,  'KHMA 667G',      'Roller - Single Drum (JCB)',     'JCB',        'VM115',      'KHMA 667G',           2015, 2025, 'Patrick Kitheka', 'Njambini (South Kinangop)', 'Operational',   None,       '—',      '—',              None,       '—',    'Defective bonnet locking mechanism', 'Repair of bonnet lock; Padlock size 265 (1 pc)'),
            (7,  'DOUBLE ROLLER',  'Roller - Double Drum',           'XGMA',       'XG6071D',    'CXG06071J0D1H0183',   2017, 2024, 'Patrick Kitheka', 'Njambini / Nyandarua',     'Functional',    None,       '—',      '—',              None,       '—',    'None', 'Lockable battery compartment; Padlocks size 265 (2 pcs)'),
            (8,  'N/A',            'Roller - Double Drum (JCB)',     'JCB',        'CT160',      None,                  None, 2024, 'Harrison Njau',   'Magumu',                    'Undetermined',  None,       '—',      '—',              None,       '—',    'Undetermined — no fuel', 'Fuel to be allocated to assess machine performance'),
            (9,  'N/A',            'Roller - Pneumatic Tyre',        'XGMA',       'XG6201P',    None,                  None, 2024, '',                'HQ – Athi River',           'Operational',   None,       '—',      '—',              None,       '—',    'None reported', '—'),
            (10, 'KHMA 981B',      'Wheel Loader (Shovel)',          'SDLG',       'LG956L',     'KHMA 918B',           None, 2024, 'Harrison Njau',   'Njambini (South Kinangop)', 'Operational',   None,       '—',      '—',              None,       '—',    'Minor leakage of steering orbital kit', 'Welding repair of battery compartment cover; Padlocks size 265 (3 pcs)'),
            (11, 'KTCB 324M',      'Backhoe',                        'JCB',        '4CX',        'KTCB 324M',           None, 2024, 'John Maina',      'Magumu / Nyandarua',        'Operational',   None,       '—',      '—',              None,       '—',    'Faulty temperature gauge; Faulty hour clock; Faulty fuel gauge; Faulty lighting system; Alternator not charging', 'Wiring technician; Alternator repair'),
            (12, 'PAVER (DYNAPAC)','Paver',                          'Dynapac',    'F161-8W',    None,                  None, 2024, '',                'HQ – Athi River',           'Undetermined',  None,       '—',      '—',              None,       '—',    'Status undetermined — no fuel', 'Fuel required to assess condition'),
        ]

        for (no, reg_id, desc, make, model, serial, yom, acq, operator, loc,
             op_st, ins_exp, ins_st, insp_st, sg_exp, sg_st, defects, reqs) in MACHINES:
            code = f'LZ-MA-{no:03d}'
            upsert(
                asset_code=code,
                name=desc,
                category='machinery',
                department='Operations',
                make_model=f'{make} {model}'.strip(),
                serial_number=serial or (reg_id if reg_id not in ('N/A', None) else ''),
                location=loc,
                assigned_to=operator,
                status=map_status(op_st),
                condition='fair',
                current_defects=defects or '',
                requirements=reqs or '',
            )

        # ── SECTION B: VEHICLES ────────────────────────────────────────────────
        self.stdout.write('Seeding vehicles ...')

        VEHICLES = [
            # (no, reg_no, description, make, model, yom, acquisition,
            #  operator, location, op_status, ins_exp, ins_st, insp_st, sg_exp, sg_st, defects, reqs)
            (13, 'KBG 249K', 'Pick-up',                   'Toyota',     'Millenium 2000',     2000, 2023, '—',               'HQ – Athi River',           'Operational', None,            '—',              '—',              None,       '—',    'None reported', '—'),
            (14, 'KDL 313Q', 'Pick-up',                   'Ford',       'Ranger',             None, 2023, '—',               'HQ – Athi River',           'Operational', None,            '—',              '—',              None,       '—',    'None reported', '—'),
            (15, 'KDN 111A', 'Pick-up',                   'Isuzu',      'D-Max',              2023, 2023, 'Perminus Mwangi', 'KeNHA-Nairobi',              'Operational', None,            '—',              '—',              None,       '—',    'None reported', '—'),
            (16, 'KDN 222F', 'Pick-up',                   'Isuzu',      'D-Max',              2023, 2023, 'Alex Mutua',      'KeNHA-Nairobi',              'Operational', None,            '—',              '—',              None,       '—',    'None reported', '—'),
            (17, 'KDR 888Z', 'Toyota Hilux Double Cab',   'Toyota',     'Hilux',              2011, 2015, 'Caleb Oluoch',    'Njambini (KeRRA)',           'Operational', '25/05/2027',    'Valid',          '—',              None,       '—',    'Faulty fuel tank floater gauge', 'Tank calibration; Wiring services; Fire extinguisher'),
            (18, 'KDU 999Y', 'Toyota Hilux Double Cab',   'Toyota',     'Hilux',              None, 2025, 'Samuel Karigi',   'KeRRA-Njambini',             'Operational', '26/06/2026',    'EXPIRING SOON',  '—',              None,       '—',    'None', 'Fire extinguisher needed. Insurance expiring 26/06/2026.'),
            (19, 'KDW 277S', 'Toyota Hilux Double Cab',   'Toyota',     'Hilux',              None, 2026, 'Boniface Kioko',  'KeRRA-Njambini',             'Operational', '22/02/2027',    'Valid',          '—',              None,       '—',    'Broken spotlight holder', 'Welding repair; Fire extinguisher'),
            (20, 'KCC 077Z', 'Mini SUV',                  'Toyota',     'Rush',               None, 2024, '—',               'HQ – Athi River',            'Operational', None,            '—',              '—',              None,       '—',    'None reported', '—'),
            (21, 'KDS 764H', 'Land Cruiser Prado',        'Toyota',     'Prado',              2016, 2025, 'Samuel Maina',    'KeNHA-Nairobi',              'Operational', None,            '—',              '—',              None,       '—',    'None reported', '—'),
            (22, 'KDV 999T', 'Land Cruiser Prado',        'Toyota',     'Prado',              None, 2025, '—',               'HQ',                         'Operational', None,            '—',              '—',              None,       '—',    'None reported', '—'),
            (23, 'KDV 999Q', 'Land Cruiser Prado',        'Toyota',     'Prado',              None, 2025, '—',               'Kilimani Office',            'Operational', None,            '—',              '—',              None,       '—',    'None reported', '—'),
            (24, 'KDW 999H', 'Land Cruiser Prado',        'Toyota',     'Prado',              None, 2026, '—',               'HQ',                         'Operational', None,            '—',              '—',              None,       '—',    'None reported', '—'),
            (25, 'KDW 999G', 'Range Rover',               'Land Rover', 'Range Rover',        None, 2025, '—',               'HQ',                         'Operational', None,            '—',              '—',              None,       '—',    'None reported', '—'),
            (26, 'KDD 666Z', 'Hatchback',                 'Volkswagen', 'Polo',               None, 2023, '—',               'Kilimani Office',            'Operational', None,            '—',              '—',              None,       '—',    'None reported', '—'),
            (27, 'KBM 700W', 'Hatchback',                 'Toyota',     'Runx',               None, 2015, '—',               'N/A',                         'Operational', None,            '—',              '—',              None,       '—',    'None reported', '—'),
            (28, 'KCG 100P', 'Sedan',                     'Mercedes',   'Benz',               None, None, '—',               'N/A',                         'Operational', None,            '—',              '—',              None,       '—',    'None reported', '—'),
        ]

        # GPS-only vehicle
        GPS_ONLY = [
            ('GPS-001', 'KDG 073K', 'Toyota Hilux Silver (GPS Only)', 'Toyota', 'Hilux', None, None, '—', 'Njambini (South Kinangop)', 'Operational', None, '—', '—', None, '—', 'None reported', 'Live GPS tracked only — not yet in the manual asset register'),
        ]

        for (no, reg_no, desc, make, model, yom, acq, operator, loc,
             op_st, ins_exp, ins_st, insp_st, sg_exp, sg_st, defects, reqs) in VEHICLES:
            code = f'LZ-VH-{no:03d}'
            upsert(
                asset_code=code,
                name=desc,
                category='vehicles',
                department='Operations',
                make_model=f'{make} {model}'.strip(),
                serial_number=reg_no,
                location=loc,
                assigned_to=operator if operator != '—' else '',
                status=map_status(op_st),
                condition='fair',
                insurance_expiry=parse_date(ins_exp),
                inspection_cert_status=map_cert(insp_st),
                speed_governor_cert_expiry=parse_date(sg_exp),
                speed_governor_cert_status=map_cert(sg_st),
                current_defects=defects or '',
                requirements=reqs or '',
            )

        for (code, reg_no, desc, make, model, yom, acq, operator, loc,
             op_st, ins_exp, ins_st, insp_st, sg_exp, sg_st, defects, reqs) in GPS_ONLY:
            upsert(
                asset_code=code,
                name=desc,
                category='vehicles',
                department='Operations',
                make_model=f'{make} {model}'.strip(),
                serial_number=reg_no,
                location=loc,
                assigned_to='',
                status=map_status(op_st),
                condition='fair',
                current_defects=defects or '',
                requirements=reqs or '',
            )

        # ── SECTION C: TRUCKS, MOVERS & TRAILERS ──────────────────────────────
        self.stdout.write('Seeding trucks, movers and trailers ...')

        TRUCKS = [
            # (no, category, reg_no, description, make, model, yom, acquisition,
            #  operator, location, op_status, ins_exp, ins_st, insp_st, sg_exp, sg_st, defects, reqs)
            (29, 'Canter / Truck', 'KAJ 469P', 'Isuzu Canter (Service Van)',  'Isuzu',      'NPR 4.3',    None, 2024, 'Patrick Munene', 'Magumu (South Kinangop)', 'Operational',   '20/01/2027', 'Valid',          'EXPIRED',        None,       'EXPIRED', 'Radiator minor leakage; Cracked windscreen; Worn out tyres; Faulty lights; Body loose/shaking; Broken rear steel seats; Faulty dashboard clock; Faulty speed limiter pin', 'Inspection cert renewal; Radiator repair; New tyres; Wiring; Welding; Fire extinguisher; Speed limiter pin; Wheel alignment'),
            (30, 'Canter / Truck', 'KAM 660B', 'Fuso Canter (Water Bowser)', 'Mitsubishi', 'Fuso',       None, 2024, 'Patrick Munene', 'HQ – Athi River',         'Non-Operational','29/06/2026', 'EXPIRING SOON',  'Not in System',  None,       'EXPIRED', 'Cracked windscreen; Gear engagement failure; Foggy headlights; Worn rear light lenses; Missing LHS door glass; Defective handbrake; Missing spare tyre compartment', 'Windscreen replacement; Gear lever bushes; New headlights; New rear light lenses; LHS door glass; New handbrake; Wheel alignment; Welding; Wiring'),
            (31, 'Prime Mover',   'KCC 828E', 'Prime Mover',                 'Mercedes',   'Axor-2543',  2011, 2024, '—',              'HQ – Athi River',         'Operational',   None,         '—',              '—',              None,       '—',    'None reported', '—'),
            (32, 'Trailer',       'ZH 1881',  'Trailer 3-Axle',              'Bhachu',     '3-Axle',     None, 2024, '—',              'HQ',                      'Operational',   None,         '—',              '—',              None,       '—',    'None reported', '—'),
            (33, 'Prime Mover',   'KDU 776A', 'Prime Mover',                 'UD',         'Quester',    2025, 2026, 'Solomon Wafula', 'HQ',                      'Operational',   None,         '—',              '—',              None,       '—',    'None reported', '—'),
            (34, 'Low Loader',    'ZJ 2153',  'Low Loader 4-Axle',           'Bhachu',     '4-Axle',     2026, 2026, '—',              'HQ',                      'Operational',   None,         '—',              '—',              None,       '—',    'None reported', '—'),
            (35, 'Prime Mover',   'KDW 385P', 'Prime Mover',                 'Howo',       'Sino Truck', 2025, 2026, '—',              'HQ',                      'Operational',   None,         '—',              '—',              None,       '—',    'None reported', '—'),
            (36, 'Prime Mover',   'KDW 387P', 'Prime Mover',                 'Howo',       'Sino Truck', 2025, 2026, '—',              'HQ',                      'Operational',   None,         '—',              '—',              None,       '—',    'None reported', '—'),
            (37, 'Tipper',        'KDY 466D', 'Isuzu FVZ Tipper',            'Isuzu',      'FVZ Blue Power', 2022, 2026, '—',          'Njambini',                'Operational',   '02/06/2027', 'Valid',          'Not in System',  '14/05/2027','Valid','Deformed rear lights steel bracket', 'Repair & fabrication of rear lights bracket; Padlocks size 265 (2 pcs); Note: inspection cert not in system'),
        ]

        TT_COUNTER = {
            'Canter / Truck': 0, 'Prime Mover': 0, 'Trailer': 0,
            'Low Loader': 0, 'Tipper': 0,
        }
        for (no, cat, reg_no, desc, make, model, yom, acq, operator, loc,
             op_st, ins_exp, ins_st, insp_st, sg_exp, sg_st, defects, reqs) in TRUCKS:
            code = f'LZ-TT-{no - 28:03d}'
            upsert(
                asset_code=code,
                name=desc,
                category='trucks_tracks',
                department='Operations',
                make_model=f'{make} {model}'.strip(),
                serial_number=reg_no,
                location=loc,
                assigned_to=operator if operator != '—' else '',
                status=map_status(op_st),
                condition='fair',
                insurance_expiry=parse_date(ins_exp),
                inspection_cert_status=map_cert(insp_st),
                speed_governor_cert_expiry=parse_date(sg_exp),
                speed_governor_cert_status=map_cert(sg_st),
                current_defects=defects or '',
                requirements=reqs or '',
            )

        if not dry:
            self.stdout.write(self.style.SUCCESS(
                f'\nDone. Created: {stats["created"]}, Updated: {stats["updated"]}'
            ))
        else:
            self.stdout.write(self.style.WARNING('\nDry run complete — no data saved.'))
