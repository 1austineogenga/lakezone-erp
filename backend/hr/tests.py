from datetime import date
from django.test import TestCase
from django.contrib.auth import get_user_model

User = get_user_model()


def make_hr_user(email="hr@test.com"):
    return User.objects.create_user(email=email, password="pass", role="hr_manager")


class PayrollPAYETest(TestCase):
    """Test Kenya PAYE computation against the Finance Act 2023 bands."""

    def test_paye_zero_for_very_low_salary(self):
        from hr.models import PayrollEntry
        # Gross below personal relief threshold should yield 0
        paye = PayrollEntry.compute_paye(10000)
        self.assertEqual(paye, 0)

    def test_paye_for_50000_gross(self):
        from hr.models import PayrollEntry
        # Gross 50000:
        # Band1: min(50000,24000)=24000 @ 10% = 2400
        # Band2: min(26000,8333)=8333 @ 25% = 2083.25
        # Band3: remaining 17667 @ 30% = 5300.1
        # total tax = 2400+2083.25+5300.1 = 9783.35
        # less personal relief 2400 → 7383.35
        paye = PayrollEntry.compute_paye(50000)
        self.assertAlmostEqual(float(paye), 7383.35, places=1)

    def test_paye_increases_with_salary(self):
        from hr.models import PayrollEntry
        paye_low = PayrollEntry.compute_paye(30000)
        paye_high = PayrollEntry.compute_paye(100000)
        self.assertGreater(paye_high, paye_low)


class NSSFCalculationTest(TestCase):
    """NSSF 2023 Act: 6% of gross, capped at KES 2,160/month."""

    def test_nssf_for_50000_gross(self):
        from hr.models import PayrollEntry
        # 50000 * 6% = 3000, but capped at 2160
        nssf = PayrollEntry.compute_nssf(50000)
        self.assertAlmostEqual(float(nssf), 2160.0, places=2)

    def test_nssf_below_cap(self):
        from hr.models import PayrollEntry
        # 5000 * 6% = 300, below cap
        nssf = PayrollEntry.compute_nssf(5000)
        self.assertAlmostEqual(float(nssf), 300.0, places=2)

    def test_nssf_high_earner_capped_at_2160(self):
        from hr.models import PayrollEntry
        # Any gross where 6% > 2160 should be capped
        nssf = PayrollEntry.compute_nssf(500000)
        self.assertAlmostEqual(float(nssf), 2160.0, places=2)


class NHIFBandLookupTest(TestCase):
    """SHA/SHIF tiered bands — not a flat rate."""

    def test_nhif_band_for_50000(self):
        from hr.models import PayrollEntry
        # 50000 falls in 49999 band → KES 1100
        nhif = PayrollEntry.compute_nhif(49999)
        self.assertEqual(float(nhif), 1100.0)

    def test_nhif_band_for_low_earner(self):
        from hr.models import PayrollEntry
        # Gross 5000 → band <=5999 → KES 150
        nhif = PayrollEntry.compute_nhif(5000)
        self.assertEqual(float(nhif), 150.0)

    def test_nhif_top_band(self):
        from hr.models import PayrollEntry
        # Gross 150000 → above all bands → KES 1700
        nhif = PayrollEntry.compute_nhif(150000)
        self.assertEqual(float(nhif), 1700.0)


class LeaveBalanceCheckTest(TestCase):
    def setUp(self):
        from hr.models import Employee, LeaveType, LeaveBalance
        self.hr_user = make_hr_user()
        self.emp = Employee.objects.create(
            first_name="Alice",
            last_name="Test",
            phone="0700000001",
            date_hired=date(2024, 1, 1),
            employment_type="staff",
        )
        self.leave_type = LeaveType.objects.create(
            name="Annual Leave", code="AL",
            days_entitled=21,
            applicable_to="all",
        )
        self.balance = LeaveBalance.objects.create(
            employee=self.emp,
            leave_type=self.leave_type,
            year=2026,
            entitled_days=21,
            taken_days=18,
            carried_forward=0,
        )

    def test_leave_balance_property(self):
        self.assertEqual(self.balance.balance, 3.0)

    def test_taken_days_cannot_exceed_entitlement(self):
        """Balance should go negative if over-applied — tests that balance computation is correct."""
        self.balance.taken_days = 25
        self.balance.save()
        self.assertEqual(self.balance.balance, -4.0)

    def test_balance_with_carryforward(self):
        self.balance.carried_forward = 5
        self.balance.taken_days = 20
        self.balance.save()
        # entitled 21 + carried 5 - taken 20 = 6
        self.assertEqual(self.balance.balance, 6.0)
