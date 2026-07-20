from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.employees.models import Department
import json

Employee = get_user_model()

class AdminManagementTests(TestCase):
    def setUp(self):
        self.dept = Department.objects.create(nom="Test Dept")
        
        self.admin = Employee.objects.create_superuser(
            username='admin',
            email='admin@test.com',
            password='test',
            matricule='TEST_ADMIN',
            role=Employee.Role.ADMIN
        )
        self.employee1 = Employee.objects.create_user(
            username='emp1',
            email='emp1@test.com',
            password='test',
            matricule='TEST_EMP1',
            role=Employee.Role.EMPLOYE
        )
        self.employee2 = Employee.objects.create_user(
            username='emp2',
            email='emp2@test.com',
            password='test',
            matricule='TEST_EMP2',
            role=Employee.Role.EMPLOYE
        )

    def graphql_request(self, query, variables=None, token=None):
        headers = {}
        if token:
            headers['HTTP_AUTHORIZATION'] = f'JWT {token}'
            
        from django.test.client import Client
        client = Client()
        
        response = client.post(
            '/graphql/',
            data=json.dumps({'query': query, 'variables': variables}),
            content_type='application/json',
            **headers
        )
        return json.loads(response.content)

    def test_admin_update_role_and_manager(self):
        # 1. Login as Admin
        query = '''
        mutation TokenAuth($username: String!, $password: String!) {
          tokenAuth(username: $username, password: $password) { token }
        }
        '''
        res = self.graphql_request(query, {'username': 'admin', 'password': 'test'})
        token = res['data']['tokenAuth']['token']
        
        # 2. Assign emp2 as MANAGER_N1
        update_role_mutation = '''
        mutation UpdateRole($userId: ID!, $role: String!) {
          updateUserRole(userId: $userId, role: $role) {
            success
            error
          }
        }
        '''
        res = self.graphql_request(update_role_mutation, {'userId': str(self.employee2.id), 'role': 'MANAGER_N1'}, token)
        self.assertTrue(res['data']['updateUserRole']['success'])
        self.employee2.refresh_from_db()
        self.assertEqual(self.employee2.role, 'MANAGER_N1')
        
        # 3. Assign emp2 as manager of emp1
        assign_manager_mutation = '''
        mutation AssignMgr($empId: ID!, $mgrId: ID!) {
          assignManager(employeeId: $empId, managerId: $mgrId) {
            success
            error
          }
        }
        '''
        res = self.graphql_request(assign_manager_mutation, {'empId': str(self.employee1.id), 'mgrId': str(self.employee2.id)}, token)
        self.assertTrue(res['data']['assignManager']['success'])
        self.employee1.refresh_from_db()
        self.assertEqual(self.employee1.manager.id, self.employee2.id)
        
        # 4. Try to assign self as manager (should fail)
        res = self.graphql_request(assign_manager_mutation, {'empId': str(self.employee1.id), 'mgrId': str(self.employee1.id)}, token)
        self.assertFalse(res['data']['assignManager']['success'])
        self.assertEqual(res['data']['assignManager']['error'], "Un employé ne peut pas être son propre manager.")

    def test_sso_login(self):
        sso_mutation = '''
        mutation SSOLogin($idToken: String!) {
          ssoLogin(idToken: $idToken) {
            success
            token
            error
          }
        }
        '''
        
        # Test 1: Invalid Token
        res = self.graphql_request(sso_mutation, {'idToken': 'invalid_token'})
        self.assertFalse(res['data']['ssoLogin']['success'])
        self.assertIn("Invalid token", res['data']['ssoLogin']['error'])
        
        # Test 2: Mock valid admin token
        # In our schema we explicitly added a mock string for development
        res = self.graphql_request(sso_mutation, {'idToken': 'mock_google_token_admin'})
        self.assertTrue(res['data']['ssoLogin']['success'])
        self.assertIsNotNone(res['data']['ssoLogin']['token'])
        
        # Let's verify we can use this token to query me
        me_query = '''
        query GetMe { me { username } }
        '''
        me_res = self.graphql_request(me_query, None, token=res['data']['ssoLogin']['token'])
        self.assertEqual(me_res['data']['me']['username'], 'admin')

    def test_annual_rollover(self):
        from apps.notifications.tasks import rollover_annual_leaves
        from decimal import Decimal
        from apps.core.models import AuditLog
        
        # Give employee1 10 days
        self.employee1.solde_conges = Decimal('10.00')
        self.employee1.save()
        
        # Give employee2 3 days
        self.employee2.solde_conges = Decimal('3.00')
        self.employee2.save()
        
        result = rollover_annual_leaves()
        
        self.employee1.refresh_from_db()
        self.employee2.refresh_from_db()
        
        # emp1 should be capped at 5
        self.assertEqual(self.employee1.solde_conges, Decimal('5.00'))
        
        # emp2 should still be 3
        self.assertEqual(self.employee2.solde_conges, Decimal('3.00'))
        
        # verify AuditLog was created for emp1 only
        logs = AuditLog.objects.filter(target_employee_id=self.employee1.id, action=AuditLog.Action.ADJUST_BALANCE)
        self.assertEqual(logs.count(), 1)
        self.assertIn("Rollover annuel", logs.first().details)

    def test_anti_loop_manager(self):
        import graphql_jwt.shortcuts
        admin_token = graphql_jwt.shortcuts.get_token(self.admin)
        
        # A manages B. We try to set B as manager of A.
        self.employee2.manager = self.employee1
        self.employee2.save()
        
        # We need an employee3 for the second test
        self.employee3 = Employee.objects.create_user(
            username='emp3', email='emp3@test.com', password='test', matricule='EMP3', role=Employee.Role.EMPLOYE
        )
        
        mutation = '''
        mutation {
            assignManager(employeeId: "%s", managerId: "%s") {
                success
                error
            }
        }
        ''' % (self.employee1.id, self.employee2.id)
        
        response = self.graphql_request(mutation, token=admin_token)
        data = response['data']['assignManager']
        
        self.assertFalse(data['success'])
        self.assertIn("Boucle Hiérarchique Interdite", data['error'])
        
        # Test valid assignment
        mutation2 = '''
        mutation {
            assignManager(employeeId: "%s", managerId: "%s") {
                success
                error
            }
        }
        ''' % (self.employee3.id, self.employee2.id)
        
        response2 = self.graphql_request(mutation2, token=admin_token)
        self.assertTrue(response2['data']['assignManager']['success'])
