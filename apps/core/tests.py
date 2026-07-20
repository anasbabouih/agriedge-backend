from django.test import TestCase
from django.core.exceptions import PermissionDenied
from apps.core.models import AuditLog
from apps.leaves.models import LeaveRequest
from apps.employees.models import Employee, Department
from apps.notifications.tasks import accrue_monthly_leave
from decimal import Decimal

class ComplianceTests(TestCase):
    def setUp(self):
        self.dept = Department.objects.create(nom="Test Dept")
        self.regular_employee = Employee.objects.create_user(
            username='regular',
            email='regular@test.com',
            password='test',
            department=self.dept,
            matricule='TEST01',
            solde_conges=0.0
        )
        self.intern = Employee.objects.create_user(
            username='intern',
            email='intern@test.com',
            password='test',
            department=self.dept,
            matricule='TEST02',
            solde_conges=0.0,
            is_intern=True
        )
        
    def test_audit_log_deletion_blocked(self):
        log = AuditLog.objects.create(
            action=AuditLog.Action.CREATE,
            user_id=self.regular_employee.id
        )
        
        # Test instance deletion
        with self.assertRaisesMessage(PermissionDenied, "La suppression d'un journal d'audit est strictement interdite (Conformité 5 ans)."):
            log.delete()
            
        # Test QuerySet bulk deletion
        with self.assertRaisesMessage(PermissionDenied, "Les journaux d'audit ne peuvent pas être supprimés (Conformité 5 ans)."):
            AuditLog.objects.all().delete()
            
        # Assert log still exists
        self.assertEqual(AuditLog.objects.count(), 1)
        
    def test_intern_accrual_exclusion(self):
        # Run the celery task directly
        result = accrue_monthly_leave()
        
        # Refresh from DB
        self.regular_employee.refresh_from_db()
        self.intern.refresh_from_db()
        
        # Regular employee should have 2.17
        self.assertEqual(self.regular_employee.solde_conges, Decimal('2.17'))
        
        # Intern should still have 0.00
        self.assertEqual(self.intern.solde_conges, Decimal('0.00'))
        
        self.assertIn("Accrued 2.17 days to 1 employees", result)
