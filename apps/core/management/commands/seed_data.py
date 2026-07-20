import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.employees.models import Department
from apps.leaves.models import LeaveType
from apps.holidays.models import PublicHoliday
from datetime import date

Employee = get_user_model()

class Command(BaseCommand):
    help = 'Seeds the database with initial test data for AgriEdge Leave Management'

    def handle(self, *args, **kwargs):
        self.stdout.write(self.style.WARNING('Clearing existing test data...'))
        
        # Don't delete real prod data, only test users (we'll identify them by email or username)
        test_usernames = ['admin', 'rh', 'manager', 'employee', 'dg', 'intern']
        
        from apps.leaves.models import LeaveRequest, Approval
        Approval.objects.all().delete()
        LeaveRequest.objects.all().delete()
        
        Employee.objects.filter(username__in=test_usernames).delete()
        LeaveType.objects.all().delete()
        PublicHoliday.objects.all().delete()
        Department.objects.filter(nom__in=['IT', 'Ressources Humaines']).delete()
        
        from apps.core.models import CompanySettings
        CompanySettings.objects.all().delete()
        self.stdout.write(self.style.SUCCESS('Creating Company Settings...'))
        CompanySettings.objects.create(overlap_threshold_percent=50)

        self.stdout.write(self.style.SUCCESS('Creating Departments...'))
        it_dept = Department.objects.create(nom='IT')
        rh_dept = Department.objects.create(nom='Ressources Humaines')

        self.stdout.write(self.style.SUCCESS('Creating Leave Types...'))
        LeaveType.objects.create(libelle='Congé Payé', deductible_solde=True, requires_attachment=False, notice_days=7, requires_motif=False)
        LeaveType.objects.create(libelle='Congé Sans Solde', deductible_solde=False, requires_attachment=False, notice_days=0, requires_motif=True)
        LeaveType.objects.create(libelle='Congé Exceptionnel', deductible_solde=False, requires_attachment=True, notice_days=0, requires_motif=True)
        LeaveType.objects.create(libelle='Maladie', deductible_solde=False, requires_attachment=True, notice_days=0, requires_motif=False)
        LeaveType.objects.create(libelle='Récupération', deductible_solde=False, requires_attachment=False, notice_days=0, requires_motif=False)

        self.stdout.write(self.style.SUCCESS('Creating Public Holidays...'))
        PublicHoliday.objects.create(date=date(2026, 1, 1), libelle="Jour de l'An")
        PublicHoliday.objects.create(date=date(2026, 1, 11), libelle="Manifeste de l'Indépendance")
        PublicHoliday.objects.create(date=date(2026, 5, 1), libelle="Fête du Travail")
        PublicHoliday.objects.create(date=date(2026, 7, 30), libelle="Fête du Trône")
        PublicHoliday.objects.create(date=date(2026, 8, 14), libelle="Oued Ed-Dahab")
        PublicHoliday.objects.create(date=date(2026, 8, 20), libelle="Révolution du Roi et du Peuple")
        PublicHoliday.objects.create(date=date(2026, 8, 21), libelle="Fête de la Jeunesse")
        PublicHoliday.objects.create(date=date(2026, 11, 6), libelle="Marche Verte")
        PublicHoliday.objects.create(date=date(2026, 11, 18), libelle="Fête de l'Indépendance")

        self.stdout.write(self.style.SUCCESS('Creating Users...'))
        
        # Admin
        admin = Employee.objects.create_superuser(
            username='admin',
            email='admin@agriedge.com',
            password='password123',
            first_name='Admin',
            last_name='System',
            matricule='AE_ADMIN_01',
            role=Employee.Role.ADMIN,
            solde_conges=26.0
        )

        # RH
        rh = Employee.objects.create_user(
            username='rh',
            email='rh@agriedge.com',
            password='password123',
            first_name='Fatima',
            last_name='Zahra',
            matricule='AE_RH_01',
            department=rh_dept,
            role=Employee.Role.RH,
            solde_conges=26.0
        )

        # Manager N1
        manager = Employee.objects.create_user(
            username='manager',
            email='manager@agriedge.com',
            password='password123',
            first_name='Ahmed',
            last_name='Manager',
            matricule='AE_MGR_01',
            department=it_dept,
            role=Employee.Role.MANAGER_N1,
            solde_conges=26.0
        )

        # Employee
        employee = Employee.objects.create_user(
            username='employee',
            email='employee@agriedge.com',
            password='password123',
            first_name='Anas',
            last_name='Dev',
            matricule='AE_EMP_01',
            department=it_dept,
            manager=manager,
            role=Employee.Role.EMPLOYE,
            solde_conges=26.0
        )

        # DG
        dg = Employee.objects.create_user(
            username='dg',
            email='dg@agriedge.com',
            password='password123',
            first_name='Omar',
            last_name='Directeur',
            matricule='AE_DG_01',
            role=Employee.Role.DIRECTEUR_GENERAL,
            solde_conges=26.0
        )
        
        # Intern
        intern = Employee.objects.create_user(
            username='intern',
            email='intern@agriedge.com',
            password='password123',
            first_name='Sara',
            last_name='Stagiaire',
            matricule='AE_STG_01',
            department=it_dept,
            role=Employee.Role.EMPLOYE,
            solde_conges=0.0,
            is_intern=True
        )

        self.stdout.write(self.style.SUCCESS('Database successfully seeded!'))
        self.stdout.write(self.style.SUCCESS('Test Accounts (Password: password123):'))
        self.stdout.write(self.style.SUCCESS('  - admin / rh / manager / employee / dg / intern'))
