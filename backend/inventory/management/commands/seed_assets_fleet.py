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
                live = '🟢' if kwargs.get('is_live') else '⚫'
                self.stdout.write(f'  {live} [vehicle] {vehicle_no} — {kwargs.get("vehicle_name", "")}')
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
                self.stdout.write(f'  [asset] {asset_code} — {kwargs.get("name")}')
                return
            obj, created = Asset.objects.update_or_create(asset_code=asset_code, defaults=kwargs)
            stats['a_created' if created else 'a_updated'] += 1

        # ── PLANT MACHINE FLEET VEHICLES ───────────────────────────────────────
        # Plant machines tracked by GPS use their serial / GPS ID as vehicle_no.
        # Machines without a known GPS ID are seeded with their asset code as vehicle_no.
        self.stdout.write('Seeding plant machine fleet records ...')

        MACHINES_FLEET = [
            # (vehicle_no/GPS ID, vehicle_name, make, model, year, asset_category, location,
            #  is_live, erp_status, asset_no, chassis_number)
            ('KHMA 460N',        'Excavator Jonyang',       'Jonyang',  'JY625E',     2023, 'Plant Machine', 'Njambini', True,  'OPER',    1,  None),
            ('KHMA 460N-CAT',    'Excavator Caterpillar',   'Caterpillar','323D-2L',  None, 'Plant Machine', 'Njambini', False, 'OPER',    2,  None),
            ('CAT 140G',         'Grader Caterpillar',      'Caterpillar','140G',     1994, 'Plant Machine', 'Njambini', True,  'OPER',    3,  'KHMA 584G'),
            ('KBG 365F',         'Grader Caterpillar #2',   'Caterpillar','140G',     None, 'Plant Machine', 'Njambini', False, 'NON-OPER',4,  'KBG 365F'),
            ('KHMA 996K',        'Roller Single Drum XGMA', 'XGMA',     'XG6181M-I', 2017, 'Plant Machine', 'Njambini', True,  'OPER',    5,  'XG06188L0H110255K'),
            ('KHMA 667G',        'Roller Single Drum JCB',  'JCB',      'VM115',     2015, 'Plant Machine', 'Njambini', True,  'OPER',    6,  'KHMA 667G'),
            ('DOUBLE ROLLER',    'Roller Double Drum XGMA', 'XGMA',     'XG6071D',   2017, 'Plant Machine', 'Njambini', True,  'OPER',    7,  'CXG06071J0D1H0183'),
            ('LZ-MA-008',        'Roller Double Drum JCB',  'JCB',      'CT160',     None, 'Plant Machine', 'Magumu',   False, 'UNKNOWN', 8,  None),
            ('LZ-MA-009',        'Roller Pneumatic XGMA',   'XGMA',     'XG6201P',   None, 'Plant Machine', 'HQ',       False, 'OPER',    9,  None),
            ('KHMA 981B',        'Wheel Loader SDLG',       'SDLG',     'LG956L',    None, 'Plant Machine', 'Njambini', True,  'OPER',    10, 'KHMA 918B'),
            ('KTCB 324M',        'Backhoe JCB',             'JCB',      '4CX',       None, 'Plant Machine', 'Magumu',   True,  'OPER',    11, 'KTCB 324M'),
            ('PAVER (DYNAPAC)',  'Paver Dynapac',           'Dynapac',  'F161-8W',   None, 'Plant Machine', 'HQ',       True,  'OPER',    12, None),
        ]

        for (vno, vname, make, model, year, acat, loc, live, erp, asno, chassis) in MACHINES_FLEET:
            kw = dict(
                vehicle_name=vname, make=make, model_name=model,
                year=year, vehicle_type='machine', last_location=loc,
                asset_no=asno, asset_category=acat,
                is_live=live, source='live' if live else 'register',
                erp_status=erp, is_active=True,
            )
            if chassis:
                kw['chassis_number'] = chassis
            upsert_vehicle(vehicle_no=vno, **kw)

        # ── WHEELED FLEET VEHICLES ─────────────────────────────────────────────
        self.stdout.write('Seeding wheeled fleet vehicles ...')

        # GPS-live plate numbers (from June 2026 fleet status report)
        GPS_LIVE = {'KAJ 469P', 'KAM 660B', 'KCC 828E', 'KDU 999Y', 'KDG 073K'}

        VEHICLES = [
            # (vehicle_no, vehicle_name, make, model, year, vehicle_type,
            #  asset_category, location, erp_status, asset_no, chassis_number,
            #  year_manufacture, year_acquired)
            ('KBG 249K', 'Pick-up Toyota Millenium', 'Toyota',     'Millenium 2000',  2000, 'pickup',      'Vehicle',        'HQ',              'OPER',    13, None, 2000, None),
            ('KDL 313Q', 'Pick-up Ford Ranger',      'Ford',       'Ranger',          None, 'pickup',      'Vehicle',        'HQ',              'OPER',    14, None, None, None),
            ('KDN 111A', 'Pick-up Isuzu D-Max',      'Isuzu',      'D-Max',           2023, 'pickup',      'Vehicle',        'KeNHA-Nairobi',   'OPER',    15, None, 2023, None),
            ('KDN 222F', 'Pick-up Isuzu D-Max',      'Isuzu',      'D-Max',           2023, 'pickup',      'Vehicle',        'KeNHA-Nairobi',   'OPER',    16, None, 2023, None),
            ('KDR 888Z', 'Toyota Hilux',              'Toyota',     'Hilux',           2011, 'pickup',      'Vehicle',        'Njambini',        'OPER',    17, None, 2011, None),
            ('KDU 999Y', 'Toyota Hilux',              'Toyota',     'Hilux',           None, 'pickup',      'Vehicle',        'KeRRA-Njambini',  'OPER',    18, None, None, None),
            ('KDW 277S', 'Toyota Hilux',              'Toyota',     'Hilux',           None, 'pickup',      'Vehicle',        'KeRRA-Njambini',  'OPER',    19, None, None, None),
            ('KCC 077Z', 'Toyota Rush',               'Toyota',     'Rush',            None, 'suv',         'Vehicle',        'HQ',              'OPER',    20, None, None, None),
            ('KDS 764H', 'Land Cruiser Prado',        'Toyota',     'Prado',           2016, 'suv',         'Vehicle',        'KeNHA-Nairobi',   'OPER',    21, None, 2016, None),
            ('KDV 999T', 'Land Cruiser Prado',        'Toyota',     'Prado',           None, 'suv',         'Vehicle',        'HQ',              'OPER',    22, None, None, None),
            ('KDV 999Q', 'Land Cruiser Prado',        'Toyota',     'Prado',           None, 'suv',         'Vehicle',        'Kilimani Office', 'OPER',    23, None, None, None),
            ('KDW 999H', 'Land Cruiser Prado',        'Toyota',     'Prado',           None, 'suv',         'Vehicle',        'HQ',              'OPER',    24, None, None, None),
            ('KDW 999G', 'Range Rover',               'Land Rover', 'Range Rover',     None, 'suv',         'Vehicle',        'HQ',              'OPER',    25, None, None, None),
            ('KDD 666Z', 'VW Polo',                   'Volkswagen', 'Polo',            None, 'hatchback',   'Vehicle',        'Kilimani Office', 'OPER',    26, None, None, None),
            ('KBM 700W', 'Toyota Runx',               'Toyota',     'Runx',            None, 'hatchback',   'Vehicle',        'N/A',             'OPER',    27, None, None, None),
            ('KCG 100P', 'Mercedes Benz',             'Mercedes',   'Benz',            None, 'sedan',       'Vehicle',        'N/A',             'OPER',    28, None, None, None),
            ('KAJ 469P', 'Isuzu Canter (Service Van)','Isuzu',      'NPR 4.3',         None, 'truck',       'Canter / Truck', 'Magumu',          'OPER',    29, None, None, None),
            ('KAM 660B', 'Fuso Canter (Water Bowser)','Mitsubishi', 'Fuso',            None, 'truck',       'Canter / Truck', 'HQ',              'NON-OPER',30, None, None, None),
            ('KCC 828E', 'Prime Mover Mercedes',      'Mercedes',   'Axor-2543',       2011, 'prime_mover', 'Prime Mover',    'HQ',              'OPER',    31, None, 2011, None),
            ('ZH 1881',  'Trailer 3-Axle',            'Bhachu',     '3-Axle',          None, 'trailer',     'Trailer',        'HQ',              'OPER',    32, None, None, None),
            ('KDU 776A', 'Prime Mover UD Quester',    'UD',         'Quester',         2025, 'prime_mover', 'Prime Mover',    'HQ',              'OPER',    33, None, 2025, None),
            ('ZJ 2153',  'Low Loader 4-Axle',         'Bhachu',     '4-Axle',          2026, 'trailer',     'Low Loader',     'HQ',              'OPER',    34, None, 2026, None),
            ('KDW 385P', 'Prime Mover Howo',          'Howo',       'Sino Truck',      2025, 'prime_mover', 'Prime Mover',    'HQ',              'OPER',    35, None, 2025, None),
            ('KDW 387P', 'Prime Mover Howo',          'Howo',       'Sino Truck',      2025, 'prime_mover', 'Prime Mover',    'HQ',              'OPER',    36, None, 2025, None),
            ('KDY 466D', 'Isuzu FVZ Tipper',          'Isuzu',      'FVZ Blue Power',  2022, 'truck',       'Tipper',         'Njambini',        'OPER',    37, None, 2022, None),
            # GPS-only record (tracked but no prior register entry)
            ('KDG 073K', 'Unknown Vehicle (GPS Only)', None,         None,              None, None,          'Vehicle',        None,              'UNKNOWN', None, None, None, None),
        ]

        for (vno, vname, make, model, year, vtype, acat, loc, erp, asno, chassis, yrman, yracq) in VEHICLES:
            live = vno in GPS_LIVE
            kw = dict(
                vehicle_name=vname, make=make, model_name=model,
                year=year, vehicle_type=vtype, last_location=loc,
                asset_no=asno, asset_category=acat,
                is_live=live, source='live' if live else 'register',
                erp_status=erp, is_active=True,
            )
            if chassis:
                kw['chassis_number'] = chassis
            if yrman:
                kw['year_manufacture'] = yrman
            if yracq:
                kw['year_acquired'] = yracq
            upsert_vehicle(vehicle_no=vno, **kw)

        # ── VEHICLE COMPLIANCE (from Fleet Status Report June 2026) ────────────
        self.stdout.write('Seeding vehicle compliance ...')

        def get_v(no):
            if dry:
                return object()
            try:
                return Vehicle.objects.get(vehicle_no=no)
            except Vehicle.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'  Vehicle {no} not found, skipping compliance'))
                return None

        v = get_v('KDW 277S')
        set_compliance(v, 'insurance', date(2027, 2, 22))

        v = get_v('KDU 999Y')
        set_compliance(v, 'insurance', date(2026, 6, 26))

        v = get_v('KDR 888Z')
        set_compliance(v, 'insurance', date(2027, 5, 25))

        v = get_v('KAJ 469P')
        set_compliance(v, 'insurance',      date(2027, 1, 20))
        set_compliance(v, 'inspection',     None, 'expired',       'Expired — renewal required')
        set_compliance(v, 'speed_governor', None, 'expired',       'Expired — renewal required')

        v = get_v('KAM 660B')
        set_compliance(v, 'insurance',      date(2026, 6, 29))
        set_compliance(v, 'inspection',     None, 'not_in_system', 'Not in the system')
        set_compliance(v, 'speed_governor', None, 'expired',       'Expired')

        v = get_v('KDY 466D')
        set_compliance(v, 'insurance',      date(2027, 6, 2))
        set_compliance(v, 'inspection',     None, 'not_in_system', 'Not in the system')
        set_compliance(v, 'speed_governor', date(2027, 5, 14))

        # ── PLANT MACHINE ASSETS (inventory.Asset) ─────────────────────────────
        self.stdout.write('Seeding plant machine assets ...')

        MACHINES_ASSETS = [
            # code, name, make_model, serial, year, location, assigned_to, status
            ('LZ-MA-001', 'Excavator',               'Jonyang JY625E',      None,                  2023, 'Njambini', 'Francis Kiarie',  'operational'),
            ('LZ-MA-002', 'Excavator',               'Caterpillar 323D-2L', None,                  None, 'Njambini', 'Francis Kiarie',  'operational'),
            ('LZ-MA-003', 'Grader',                  'Caterpillar 140G',    'KHMA 584G',           1994, 'Njambini', 'Abiero Malaki',   'operational'),
            ('LZ-MA-004', 'Grader',                  'Caterpillar 140G',    'KBG 365F',            None, 'Njambini', 'Harun Muriithi',  'non_operational'),
            ('LZ-MA-005', 'Roller - Single Drum',    'XGMA XG6181M-I',      'XG06188L0H110255K',   2017, 'Njambini', 'Patrick Kitheka', 'operational'),
            ('LZ-MA-006', 'Roller - Single Drum',    'JCB VM115',           'KHMA 667G',           2015, 'Njambini', 'Patrick Kitheka', 'operational'),
            ('LZ-MA-007', 'Roller - Double Drum',    'XGMA XG6071D',        'CXG06071J0D1H0183',   2017, 'Njambini', 'Patrick Kitheka', 'functional'),
            ('LZ-MA-008', 'Roller - Double Drum',    'JCB CT160',           None,                  None, 'Magumu',   'Harrison Njau',   'undetermined'),
            ('LZ-MA-009', 'Roller - Pneumatic Tyre', 'XGMA XG6201P',        None,                  None, 'HQ',       '',                'operational'),
            ('LZ-MA-010', 'Wheel Loader (Shovel)',   'SDLG LG956L',         'KHMA 918B',           None, 'Njambini', 'Harrison Njau',   'operational'),
            ('LZ-MA-011', 'Backhoe',                 'JCB 4CX',             'KTCB 324M',           None, 'Magumu',   'John Maina',      'operational'),
            ('LZ-MA-012', 'Paver',                   'Dynapac F161-8W',     None,                  None, 'HQ',       '',                'operational'),
        ]

        for (code, name, make_model, serial, year, loc, assigned, status) in MACHINES_ASSETS:
            upsert_asset(
                asset_code=code, name=name, category='machinery',
                department='Operations', make_model=make_model,
                serial_number=serial or '', location=loc,
                assigned_to=assigned, status=status, condition='fair',
            )

        # ── VEHICLE / MOVER ASSETS (inventory.Asset) ──────────────────────────
        self.stdout.write('Seeding vehicle and mover assets ...')

        VEHICLE_ASSETS = [
            # code, name, make_model, reg_no(serial), year, category, location, assigned_to, status
            ('LZ-VH-001', 'Pick-up Toyota Millenium',   'Toyota Millenium 2000',  'KBG 249K', 2000, 'vehicles',     'HQ',              '',                'operational'),
            ('LZ-VH-002', 'Pick-up Ford Ranger',        'Ford Ranger',            'KDL 313Q', None, 'vehicles',     'HQ',              '',                'operational'),
            ('LZ-VH-003', 'Pick-up Isuzu D-Max',        'Isuzu D-Max',            'KDN 111A', 2023, 'vehicles',     'KeNHA-Nairobi',   'Perminus Mwangi', 'operational'),
            ('LZ-VH-004', 'Pick-up Isuzu D-Max',        'Isuzu D-Max',            'KDN 222F', 2023, 'vehicles',     'KeNHA-Nairobi',   'Alex Mutua',      'operational'),
            ('LZ-VH-005', 'Toyota Hilux',               'Toyota Hilux',           'KDR 888Z', 2011, 'vehicles',     'Njambini',        'Caleb Oluoch',    'operational'),
            ('LZ-VH-006', 'Toyota Hilux',               'Toyota Hilux',           'KDU 999Y', None, 'vehicles',     'KeRRA-Njambini',  'Samuel Karigi',   'operational'),
            ('LZ-VH-007', 'Toyota Hilux',               'Toyota Hilux',           'KDW 277S', None, 'vehicles',     'KeRRA-Njambini',  'Boniface Kioko',  'operational'),
            ('LZ-VH-008', 'Toyota Rush',                'Toyota Rush',            'KCC 077Z', None, 'vehicles',     'HQ',              '',                'operational'),
            ('LZ-VH-009', 'Land Cruiser Prado',         'Toyota Prado',           'KDS 764H', 2016, 'vehicles',     'KeNHA-Nairobi',   'Samuel Maina',    'operational'),
            ('LZ-VH-010', 'Land Cruiser Prado',         'Toyota Prado',           'KDV 999T', None, 'vehicles',     'HQ',              '',                'operational'),
            ('LZ-VH-011', 'Land Cruiser Prado',         'Toyota Prado',           'KDV 999Q', None, 'vehicles',     'Kilimani Office', '',                'operational'),
            ('LZ-VH-012', 'Land Cruiser Prado',         'Toyota Prado',           'KDW 999H', None, 'vehicles',     'HQ',              '',                'operational'),
            ('LZ-VH-013', 'Range Rover',                'Land Rover Range Rover', 'KDW 999G', None, 'vehicles',     'HQ',              '',                'operational'),
            ('LZ-VH-014', 'VW Polo',                    'Volkswagen Polo',        'KDD 666Z', None, 'vehicles',     'Kilimani Office', '',                'operational'),
            ('LZ-VH-015', 'Toyota Runx',                'Toyota Runx',            'KBM 700W', None, 'vehicles',     'N/A',             '',                'operational'),
            ('LZ-VH-016', 'Mercedes Benz',              'Mercedes Benz Sedan',    'KCG 100P', None, 'vehicles',     'N/A',             '',                'operational'),
            ('LZ-TT-001', 'Isuzu Canter (Service Van)', 'Isuzu NPR 4.3',          'KAJ 469P', None, 'trucks_tracks','Magumu',          'Patrick Munene',  'operational'),
            ('LZ-TT-002', 'Fuso Canter (Water Bowser)', 'Mitsubishi Fuso',        'KAM 660B', None, 'trucks_tracks','HQ',              'Patrick Munene',  'non_operational'),
            ('LZ-TT-003', 'Prime Mover Mercedes',       'Mercedes Axor-2543',     'KCC 828E', 2011, 'trucks_tracks','HQ',              '',                'operational'),
            ('LZ-TT-004', 'Trailer 3-Axle',             'Bhachu 3-Axle',          'ZH 1881',  None, 'trucks_tracks','HQ',              '',                'operational'),
            ('LZ-TT-005', 'Prime Mover UD Quester',     'UD Quester',             'KDU 776A', 2025, 'trucks_tracks','HQ',              'Solomon Wafula',  'operational'),
            ('LZ-TT-006', 'Low Loader 4-Axle',          'Bhachu 4-Axle',          'ZJ 2153',  2026, 'trucks_tracks','HQ',              '',                'operational'),
            ('LZ-TT-007', 'Prime Mover Howo',           'Howo Sino Truck',        'KDW 385P', 2025, 'trucks_tracks','HQ',              '',                'operational'),
            ('LZ-TT-008', 'Prime Mover Howo',           'Howo Sino Truck',        'KDW 387P', 2025, 'trucks_tracks','HQ',              '',                'operational'),
            ('LZ-TT-009', 'Isuzu FVZ Tipper',           'Isuzu FVZ Blue Power',   'KDY 466D', 2022, 'trucks_tracks','Njambini',        '',                'operational'),
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
            ('LZ-VH-007', date(2027, 2, 22), None,             None,            None),
            ('LZ-VH-006', date(2026, 6, 26), None,             None,            None),
            ('LZ-VH-005', date(2027, 5, 25), None,             None,            None),
            ('LZ-TT-001', date(2027, 1, 20), 'expired',        None,            'expired'),
            ('LZ-TT-002', date(2026, 6, 29), 'not_in_system',  None,            'expired'),
            ('LZ-TT-009', date(2027, 6, 2),  'not_in_system',  date(2027, 5, 14), 'valid'),
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
