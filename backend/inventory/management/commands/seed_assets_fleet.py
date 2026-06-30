"""
Seed company assets and fleet vehicles from the June 2026 asset register
and fleet status report.

Usage:
    python backend/manage.py seed_assets_fleet
    python backend/manage.py seed_assets_fleet --dry-run
"""
from datetime import date
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Seed fleet vehicles, vehicle compliance, and asset records'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Print what would be created without saving')

    def handle(self, *args, **options):
        dry = options['dry_run']
        if dry:
            self.stdout.write(self.style.WARNING('DRY RUN — no data will be saved\n'))

        from fleet.models import Vehicle, VehicleCompliance
        from inventory.models import Asset

        stats = {'v_created': 0, 'v_updated': 0, 'a_created': 0, 'a_updated': 0}

        def upsert_vehicle(vehicle_no, **kwargs):
            if dry:
                self.stdout.write(f'  [vehicle] {vehicle_no}')
                return None
            obj, created = Vehicle.objects.update_or_create(vehicle_no=vehicle_no, defaults=kwargs)
            stats['v_created' if created else 'v_updated'] += 1
            return obj

        def set_compliance(vehicle, c_type, expiry=None, status=None, notes=''):
            if vehicle is None:
                return
            if status is None:
                status = 'expired' if (expiry and expiry < date.today()) else ('valid' if expiry else 'unknown')
            if dry:
                self.stdout.write(f'    compliance {c_type}: {status} exp={expiry}')
                return
            VehicleCompliance.objects.update_or_create(
                vehicle=vehicle, compliance_type=c_type,
                defaults={'expiry_date': expiry, 'status': status, 'notes': notes},
            )

        def upsert_asset(asset_code, **kwargs):
            if dry:
                self.stdout.write(f'  [asset] {asset_code} {kwargs.get("name")}')
                return
            obj, created = Asset.objects.update_or_create(asset_code=asset_code, defaults=kwargs)
            stats['a_created' if created else 'a_updated'] += 1

        # ── FLEET VEHICLES ─────────────────────────────────────────────────────
        self.stdout.write('Seeding fleet vehicles ...')

        VEHICLES = [
            # vehicle_no, vehicle_name, make, model, year, vehicle_type, location, asset_no
            ('KBG 249K', 'Pick-up',              'Toyota',     'Millenium 2000',  2000, 'pickup',      'HQ',              13),
            ('KDL 313Q', 'Pick-up',              'Ford',       'Ranger',          None, 'pickup',      'HQ',              14),
            ('KDN 111A', 'Pick-up Isuzu D-Max',  'Isuzu',      'D-Max',           2023, 'pickup',      'KeNHA-Nairobi',   15),
            ('KDN 222F', 'Pick-up Isuzu D-Max',  'Isuzu',      'D-Max',           2023, 'pickup',      'KeNHA-Nairobi',   16),
            ('KDR 888Z', 'Toyota Hilux',          'Toyota',     'Hilux',           2011, 'pickup',      'Njambini',        17),
            ('KDU 999Y', 'Toyota Hilux',          'Toyota',     'Hilux',           None, 'pickup',      'KeRRA-Njambini',  18),
            ('KDW 277S', 'Toyota Hilux',          'Toyota',     'Hilux',           None, 'pickup',      'KeRRA-Njambini',  19),
            ('KCC 077Z', 'Toyota Rush',           'Toyota',     'Rush',            None, 'suv',         'HQ',              20),
            ('KDS 764H', 'Land Cruiser Prado',    'Toyota',     'Prado',           2016, 'suv',         'KeNHA-Nairobi',   21),
            ('KDV 999T', 'Land Cruiser Prado',    'Toyota',     'Prado',           None, 'suv',         'HQ',              22),
            ('KDV 999Q', 'Land Cruiser Prado',    'Toyota',     'Prado',           None, 'suv',         'Kilimani Office', 23),
            ('KDW 999H', 'Land Cruiser Prado',    'Toyota',     'Prado',           None, 'suv',         'HQ',              24),
            ('KDW 999G', 'Range Rover',           'Land Rover', 'Range Rover',     None, 'suv',         'HQ',              25),
            ('KDD 666Z', 'VW Polo',               'Volkswagen', 'Polo',            None, 'hatchback',   'Kilimani Office', 26),
            ('KBM 700W', 'Toyota Runx',           'Toyota',     'Runx',            None, 'hatchback',   'N/A',             27),
            ('KCG 100P', 'Mercedes Benz',         'Mercedes',   'Benz',            None, 'sedan',       'N/A',             28),
            ('KAJ 469P', 'Isuzu Canter',          'Isuzu',      'NPR 4.3',         None, 'truck',       'Magumu',          29),
            ('KAM 660B', 'Fuso Canter',           'Mitsubishi', 'Fuso',            None, 'truck',       'HQ',              30),
            ('KCC 828E', 'Prime Mover',           'Mercedes',   'Axor-2543',       2011, 'prime_mover', 'HQ',              31),
            ('ZH 1881',  'Trailer 3-Axle',        'Bhachu',     '3-Axle',          None, 'trailer',     'HQ',              32),
            ('KDU 776A', 'Prime Mover UD Quester','UD',         'Quester',         2025, 'prime_mover', 'HQ',              33),
            ('ZJ 2153',  'Low Loader 4-Axle',     'Bhachu',     '4-Axle',          2026, 'trailer',     'HQ',              34),
            ('KDW 385P', 'Prime Mover Howo',      'Howo',       'Sino Truck',      2025, 'prime_mover', 'HQ',              35),
            ('KDW 387P', 'Prime Mover Howo',      'Howo',       'Sino Truck',      2025, 'prime_mover', 'HQ',              36),
            ('KDY 466D', 'Isuzu FVZ Tipper',      'Isuzu',      'FVZ Blue Power',  2022, 'truck',       'Njambini',        37),
        ]

        for (vno, vname, make, model, year, vtype, loc, asno) in VEHICLES:
            upsert_vehicle(
                vehicle_no=vno,
                vehicle_name=vname, make=make, model_name=model,
                year=year, vehicle_type=vtype, last_location=loc,
                asset_no=asno, is_active=True,
            )

        # ── VEHICLE COMPLIANCE (from Fleet Status Report June 2026) ────────────
        self.stdout.write('Seeding vehicle compliance ...')

        def get_v(no):
            if dry:
                return object()  # dummy so set_compliance prints
            try:
                return Vehicle.objects.get(vehicle_no=no)
            except Vehicle.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'  Vehicle {no} not found, skipping compliance'))
                return None

        # KDW 277S – Toyota Hilux (KeRRA)
        v = get_v('KDW 277S')
        set_compliance(v, 'insurance', date(2027, 2, 22))

        # KDU 999Y – Toyota Hilux (KeRRA)
        v = get_v('KDU 999Y')
        set_compliance(v, 'insurance', date(2026, 6, 26))

        # KDR 888Z – Toyota Hilux (Njambini)
        v = get_v('KDR 888Z')
        set_compliance(v, 'insurance', date(2027, 5, 25))

        # KAJ 469P – Isuzu Canter
        v = get_v('KAJ 469P')
        set_compliance(v, 'insurance',      date(2027, 1, 20))
        set_compliance(v, 'inspection',     None, 'expired',       'Expired — renewal required')
        set_compliance(v, 'speed_governor', None, 'expired',       'Expired — renewal required')

        # KAM 660B – Fuso Canter (non-operational)
        v = get_v('KAM 660B')
        set_compliance(v, 'insurance',      date(2026, 6, 29))
        set_compliance(v, 'inspection',     None, 'not_in_system', 'Not in the system')
        set_compliance(v, 'speed_governor', None, 'expired',       'Expired')

        # KDY 466D – Isuzu FVZ Tipper
        v = get_v('KDY 466D')
        set_compliance(v, 'insurance',      date(2027, 6, 2))
        set_compliance(v, 'inspection',     None, 'not_in_system', 'Not in the system')
        set_compliance(v, 'speed_governor', date(2027, 5, 14))

        # ── PLANT MACHINE ASSETS ───────────────────────────────────────────────
        self.stdout.write('Seeding plant machine assets ...')

        MACHINES = [
            # code, name, make_model, serial, year, location, assigned_to, status
            ('LZ-MA-001', 'Excavator',               'Jonyang JY625E',     None,                 2023, 'Njambini', 'Francis Kiarie',  'operational'),
            ('LZ-MA-002', 'Excavator',               'Caterpillar 323D-2L',None,                 None, 'Njambini', 'Francis Kiarie',  'operational'),
            ('LZ-MA-003', 'Grader',                  'Caterpillar 140G',   'KHMA 584G',          1994, 'Njambini', 'Abiero Malaki',   'operational'),
            ('LZ-MA-004', 'Grader',                  'Caterpillar 140G',   'KBG 365F',           None, 'Njambini', 'Harun Muriithi',  'non_operational'),
            ('LZ-MA-005', 'Roller - Single Drum',    'XGMA XG6181M-I',     'XG06188L0H110255K',  2017, 'Njambini', 'Patrick Kitheka', 'operational'),
            ('LZ-MA-006', 'Roller - Single Drum',    'JCB VM115',          'KHMA 667G',          2015, 'Njambini', 'Patrick Kitheka', 'operational'),
            ('LZ-MA-007', 'Roller - Double Drum',    'XGMA XG6071D',       'CXG06071J0D1H0183',  2017, 'Njambini', 'Patrick Kitheka', 'functional'),
            ('LZ-MA-008', 'Roller - Double Drum',    'JCB CT160',          None,                 None, 'Magumu',   'Harrison Njau',   'undetermined'),
            ('LZ-MA-009', 'Roller - Pneumatic Tyre', 'XGMA XG6201P',       None,                 None, 'HQ',       '',               'operational'),
            ('LZ-MA-010', 'Wheel Loader (Shovel)',   'SDLG LG956L',        'KHMA 918B',          None, 'Njambini', 'Harrison Njau',   'operational'),
            ('LZ-MA-011', 'Backhoe',                 'JCB 4CX',            'KTCB 324M',          None, 'Magumu',   'John Maina',      'operational'),
            ('LZ-MA-012', 'Paver',                   'Dynapac F161-8W',    None,                 None, 'HQ',       '',               'operational'),
        ]

        for (code, name, make_model, serial, year, loc, assigned, status) in MACHINES:
            upsert_asset(
                asset_code=code, name=name, category='machinery',
                department='Operations', make_model=make_model,
                serial_number=serial or '', location=loc,
                assigned_to=assigned, status=status, condition='fair',
            )

        # ── VEHICLE / MOVER ASSETS ─────────────────────────────────────────────
        self.stdout.write('Seeding vehicle/mover assets ...')

        VEHICLE_ASSETS = [
            # code, name, make_model, reg_no(serial), year, category, location, assigned_to, status
            ('LZ-VH-001', 'Pick-up Toyota Millenium',  'Toyota Millenium 2000',  'KBG 249K', 2000, 'vehicles',     'HQ',              '',                'operational'),
            ('LZ-VH-002', 'Pick-up Ford Ranger',       'Ford Ranger',            'KDL 313Q', None, 'vehicles',     'HQ',              '',                'operational'),
            ('LZ-VH-003', 'Pick-up Isuzu D-Max',       'Isuzu D-Max',            'KDN 111A', 2023, 'vehicles',     'KeNHA-Nairobi',   'Perminus Mwangi', 'operational'),
            ('LZ-VH-004', 'Pick-up Isuzu D-Max',       'Isuzu D-Max',            'KDN 222F', 2023, 'vehicles',     'KeNHA-Nairobi',   'Alex Mutua',      'operational'),
            ('LZ-VH-005', 'Toyota Hilux',              'Toyota Hilux',           'KDR 888Z', 2011, 'vehicles',     'Njambini',        'Caleb Oluoch',    'operational'),
            ('LZ-VH-006', 'Toyota Hilux',              'Toyota Hilux',           'KDU 999Y', None, 'vehicles',     'KeRRA-Njambini',  'Samuel Karigi',   'operational'),
            ('LZ-VH-007', 'Toyota Hilux',              'Toyota Hilux',           'KDW 277S', None, 'vehicles',     'KeRRA-Njambini',  'Boniface Kioko',  'operational'),
            ('LZ-VH-008', 'Toyota Rush',               'Toyota Rush',            'KCC 077Z', None, 'vehicles',     'HQ',              '',                'operational'),
            ('LZ-VH-009', 'Land Cruiser Prado',        'Toyota Prado',           'KDS 764H', 2016, 'vehicles',     'KeNHA-Nairobi',   'Samuel Maina',    'operational'),
            ('LZ-VH-010', 'Land Cruiser Prado',        'Toyota Prado',           'KDV 999T', None, 'vehicles',     'HQ',              '',                'operational'),
            ('LZ-VH-011', 'Land Cruiser Prado',        'Toyota Prado',           'KDV 999Q', None, 'vehicles',     'Kilimani Office', '',                'operational'),
            ('LZ-VH-012', 'Land Cruiser Prado',        'Toyota Prado',           'KDW 999H', None, 'vehicles',     'HQ',              '',                'operational'),
            ('LZ-VH-013', 'Range Rover',               'Land Rover Range Rover', 'KDW 999G', None, 'vehicles',     'HQ',              '',                'operational'),
            ('LZ-VH-014', 'VW Polo',                   'Volkswagen Polo',        'KDD 666Z', None, 'vehicles',     'Kilimani Office', '',                'operational'),
            ('LZ-VH-015', 'Toyota Runx',               'Toyota Runx',            'KBM 700W', None, 'vehicles',     'N/A',             '',                'operational'),
            ('LZ-VH-016', 'Mercedes Benz',             'Mercedes Benz Sedan',    'KCG 100P', None, 'vehicles',     'N/A',             '',                'operational'),
            ('LZ-TT-001', 'Isuzu Canter (Service Van)','Isuzu NPR 4.3',          'KAJ 469P', None, 'trucks_tracks','Magumu',          'Patrick Munene',  'operational'),
            ('LZ-TT-002', 'Fuso Canter (Water Bowser)','Mitsubishi Fuso',         'KAM 660B', None, 'trucks_tracks','HQ',              'Patrick Munene',  'non_operational'),
            ('LZ-TT-003', 'Prime Mover Mercedes',      'Mercedes Axor-2543',     'KCC 828E', 2011, 'trucks_tracks','HQ',              '',                'operational'),
            ('LZ-TT-004', 'Trailer 3-Axle',            'Bhachu 3-Axle',          'ZH 1881',  None, 'trucks_tracks','HQ',              '',                'operational'),
            ('LZ-TT-005', 'Prime Mover UD Quester',    'UD Quester',             'KDU 776A', 2025, 'trucks_tracks','HQ',              'Solomon Wafula',  'operational'),
            ('LZ-TT-006', 'Low Loader 4-Axle',         'Bhachu 4-Axle',          'ZJ 2153',  2026, 'trucks_tracks','HQ',              '',                'operational'),
            ('LZ-TT-007', 'Prime Mover Howo',          'Howo Sino Truck',        'KDW 385P', 2025, 'trucks_tracks','HQ',              '',                'operational'),
            ('LZ-TT-008', 'Prime Mover Howo',          'Howo Sino Truck',        'KDW 387P', 2025, 'trucks_tracks','HQ',              '',                'operational'),
            ('LZ-TT-009', 'Isuzu FVZ Tipper',          'Isuzu FVZ Blue Power',   'KDY 466D', 2022, 'trucks_tracks','Njambini',        '',                'operational'),
        ]

        for (code, name, make_model, serial, year, cat, loc, assigned, status) in VEHICLE_ASSETS:
            upsert_asset(
                asset_code=code, name=name, category=cat,
                department='Operations', make_model=make_model,
                serial_number=serial, location=loc,
                assigned_to=assigned, status=status, condition='fair',
            )

        # ── Compliance certs on vehicle assets ────────────────────────────────
        self.stdout.write('Setting asset compliance certs ...')

        ASSET_CERTS = [
            # code, ins_expiry, insp_status, sg_expiry, sg_status
            ('LZ-VH-007', date(2027, 2, 22), None,              None,           None),
            ('LZ-VH-006', date(2026, 6, 26), None,              None,           None),
            ('LZ-VH-005', date(2027, 5, 25), None,              None,           None),
            ('LZ-TT-001', date(2027, 1, 20), 'expired',         None,           'expired'),
            ('LZ-TT-002', date(2026, 6, 29), 'not_in_system',   None,           'expired'),
            ('LZ-TT-009', date(2027, 6, 2),  'not_in_system',   date(2027,5,14),'valid'),
        ]

        for (code, ins_exp, insp_st, sg_exp, sg_st) in ASSET_CERTS:
            if dry:
                self.stdout.write(f'  [cert] {code} ins={ins_exp} insp={insp_st} sg={sg_exp}/{sg_st}')
                continue
            try:
                asset = Asset.objects.get(asset_code=code)
            except Asset.DoesNotExist:
                continue
            if ins_exp:
                asset.insurance_expiry = ins_exp
            if insp_st:
                asset.inspection_cert_status = insp_st
            if sg_exp:
                asset.speed_governor_cert_expiry = sg_exp
            if sg_st:
                asset.speed_governor_cert_status = sg_st
            asset.save()

        if not dry:
            self.stdout.write(self.style.SUCCESS(
                f'\nDone.\n'
                f'  Vehicles — created: {stats["v_created"]}, updated: {stats["v_updated"]}\n'
                f'  Assets   — created: {stats["a_created"]}, updated: {stats["a_updated"]}'
            ))
        else:
            self.stdout.write(self.style.WARNING('\nDry run complete — no data saved.'))
