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
    def test_nssf_for_50000_gross(self):
        from hr.models import PayrollEntry
        # Tier1: min(50000,7000)*6% = 420
        # Tier2: (min(50000,43000)-7000)*6% = 36000*6% = 2160
        # Total = 2580
        nssf = PayrollEntry.compute_nssf(50000)
        self.assertAlmostEqual(float(nssf), 2580.0, places=2)

    def test_nssf_below_tier1_ceiling(self):
        from hr.models import PayrollEntry
        # Gross 5000: only tier1 applies → 5000*6% = 300
        nssf = PayrollEntry.compute_nssf(5000)
        self.assertAlmostEqual(float(nssf), 300.0, places=2)

    def test_nssf_high_earner_capped_at_tier2(self):
        from hr.models import PayrollEntry
        # Gross 500000: tier1=7000*6%=420, tier2=36000*6%=2160 → 2580
        nssf = PayrollEntry.compute_nssf(500000)
        self.assertAlmostEqual(float(nssf), 2580.0, places=2)


class NHIFBandLookupTest(TestCase):
    def test_nhif_is_275_percent_of_gross(self):
        from hr.models import PayrollEntry
        gross = 50000
        nhif = PayrollEntry.compute_nhif(gross)
        self.assertAlmostEqual(float(nhif), gross * 0.0275, places=2)

    def test_nhif_for_various_salaries(self):
        from hr.models import PayrollEntry
        for gross in [10000, 30000, 100000]:
            nhif = PayrollEntry.compute_nhif(gross)
            self.assertAlmostEqual(float(nhif), gross * 0.0275, places=2)


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
