import pytest
from datetime import date
from decimal import Decimal
from django.test import TestCase
from apps.holidays.models import PublicHoliday
from apps.leaves.services import calculate_leave_days

@pytest.mark.django_db
class LeaveCalculationTests(TestCase):
    def setUp(self):
        # Create a public holiday for testing
        PublicHoliday.objects.create(date=date(2026, 8, 14), libelle="Fête Nationale") # Friday
        PublicHoliday.objects.create(date=date(2026, 8, 20), libelle="Fête religieuse") # Thursday

    def test_single_weekday(self):
        # Aug 3, 2026 is a Monday
        days = calculate_leave_days(date(2026, 8, 3), date(2026, 8, 3))
        self.assertEqual(days, Decimal('1.00'))

    def test_single_weekday_half_day(self):
        days = calculate_leave_days(date(2026, 8, 3), date(2026, 8, 3), is_half_day=True)
        self.assertEqual(days, Decimal('0.50'))

    def test_single_sunday(self):
        # Aug 2, 2026 is a Sunday
        days = calculate_leave_days(date(2026, 8, 2), date(2026, 8, 2))
        self.assertEqual(days, Decimal('0.00'))
        
    def test_one_week_no_holiday(self):
        # Monday Aug 3 to Sunday Aug 9
        # Days: M, T, W, T, F (5) + Sat (first, free=0) + Sun (free=0) = 5
        days = calculate_leave_days(date(2026, 8, 3), date(2026, 8, 9))
        self.assertEqual(days, Decimal('5.00'))

    def test_two_weeks(self):
        # Monday Aug 3 to Sunday Aug 16 (includes holiday on Aug 14)
        # Week 1: M, T, W, T, F (5) + Sat (free=0) + Sun (free=0) = 5
        # Week 2: M, T, W, T (4) + F (Holiday=0) + Sat (counted=1) + Sun (free=0) = 5
        # Total: 10
        days = calculate_leave_days(date(2026, 8, 3), date(2026, 8, 16))
        self.assertEqual(days, Decimal('10.00'))

    def test_start_on_saturday(self):
        # Saturday Aug 8 to Monday Aug 10
        # Sat (first, free=0) + Sun (free=0) + Mon(1) = 1
        days = calculate_leave_days(date(2026, 8, 8), date(2026, 8, 10))
        self.assertEqual(days, Decimal('1.00'))

    def test_only_holiday(self):
        days = calculate_leave_days(date(2026, 8, 14), date(2026, 8, 14))
        self.assertEqual(days, Decimal('0.00'))
