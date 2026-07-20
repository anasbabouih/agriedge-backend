import json
from django.test import TestCase, Client
from django.core.management import call_command
from apps.employees.models import Employee
from apps.leaves.models import LeaveType, LeaveRequest

class E2EWorkflowTest(TestCase):
    def setUp(self):
        # Seed the test database using our management command
        call_command('seed_data')
        self.client = Client()
        
    def graphql_request(self, query, variables=None, token=None):
        headers = {}
        if token:
            headers['HTTP_AUTHORIZATION'] = f'JWT {token}'
            
        response = self.client.post(
            '/graphql/',
            data=json.dumps({'query': query, 'variables': variables}),
            content_type='application/json',
            **headers
        )
        return json.loads(response.content)

    def test_end_to_end_approval_workflow(self):
        # Step 1: Authenticate all users
        def login(username, password="password123"):
            query = '''
            mutation TokenAuth($username: String!, $password: String!) {
              tokenAuth(username: $username, password: $password) {
                token
              }
            }
            '''
            res = self.graphql_request(query, {'username': username, 'password': password})
            self.assertIn('data', res)
            return res['data']['tokenAuth']['token']
            
        employee_token = login('employee')
        manager_token = login('manager')
        rh_token = login('rh')

        # Step 2: Create a new leave request as employee
        leave_type = LeaveType.objects.get(libelle='Congé Payé')
        create_mutation = '''
        mutation SubmitLeave($leaveTypeId: ID!, $dateDebut: Date!, $dateFin: Date!, $isHalfDay: Boolean!, $motif: String!) {
          submitLeaveRequest(
            leaveTypeId: $leaveTypeId,
            dateDebut: $dateDebut,
            dateFin: $dateFin,
            isHalfDay: $isHalfDay,
            motif: $motif
          ) {
            success
            leaveRequest {
              id
              statut
            }
            error
          }
        }
        '''
        create_vars = {
            "leaveTypeId": str(leave_type.id),
            "dateDebut": "2026-08-10", # Monday
            "dateFin": "2026-08-14",   # Friday (5 working days)
            "isHalfDay": False,
            "motif": "Vacances E2E"
        }
        res = self.graphql_request(create_mutation, create_vars, employee_token)
        self.assertTrue(res['data']['submitLeaveRequest']['success'])
        leave_request_id = res['data']['submitLeaveRequest']['leaveRequest']['id']
        
        # Verify status is EN_ATTENTE_N1
        self.assertEqual(res['data']['submitLeaveRequest']['leaveRequest']['statut'], 'EN_ATTENTE_N1')

        # Step 3: Query pending approvals as manager and approve
        pending_query = '''
        query GetPendingApprovals {
          pendingApprovals {
            id
            statut
          }
        }
        '''
        res = self.graphql_request(pending_query, None, manager_token)
        requests = res['data']['pendingApprovals']
        
        # Manager should see exactly 1 request
        self.assertEqual(len(requests), 1)
        self.assertEqual(requests[0]['id'], leave_request_id)
        
        # Manager approves
        approve_mutation = '''
        mutation ProcessApproval($leaveRequestId: ID!, $decision: String!, $commentaire: String) {
          processApproval(leaveRequestId: $leaveRequestId, decision: $decision, commentaire: $commentaire) {
            success
            leaveRequest {
              statut
            }
            error
          }
        }
        '''
        res = self.graphql_request(approve_mutation, {
            "leaveRequestId": leave_request_id,
            "decision": "APPROUVE",
            "commentaire": "OK from manager"
        }, manager_token)
        self.assertTrue(res['data']['processApproval']['success'])
        self.assertEqual(res['data']['processApproval']['leaveRequest']['statut'], 'EN_ATTENTE_RH')

        # Step 4: Query pending approvals as RH and approve
        res = self.graphql_request(pending_query, None, rh_token)
        requests = res['data']['pendingApprovals']
        
        # RH should see exactly 1 request
        self.assertEqual(len(requests), 1)
        self.assertEqual(requests[0]['id'], leave_request_id)

        # Record balance before RH approval
        employee_before = Employee.objects.get(username='employee')
        initial_balance = employee_before.solde_conges

        # RH approves
        res = self.graphql_request(approve_mutation, {
            "leaveRequestId": leave_request_id,
            "decision": "APPROUVE",
            "commentaire": "OK from RH"
        }, rh_token)
        self.assertTrue(res['data']['processApproval']['success'])
        self.assertEqual(res['data']['processApproval']['leaveRequest']['statut'], 'VALIDE')

        # Step 5: Assert balance is mathematically deducted
        employee_after = Employee.objects.get(username='employee')
        final_balance = employee_after.solde_conges
        
        # August 10 to August 14 is Monday to Friday. August 14 is a public holiday (Oued Ed-Dahab). So 4 days.
        self.assertEqual(final_balance, initial_balance - 4)

    def test_attachment_required(self):
        query = '''
        mutation TokenAuth($username: String!, $password: String!) {
          tokenAuth(username: $username, password: $password) { token }
        }
        '''
        res = self.graphql_request(query, {'username': 'employee', 'password': 'password123'})
        token = res['data']['tokenAuth']['token']

        leave_type = LeaveType.objects.get(libelle='Maladie')
        create_mutation = '''
        mutation SubmitLeave($leaveTypeId: ID!, $dateDebut: Date!, $dateFin: Date!, $isHalfDay: Boolean!, $motif: String!) {
          submitLeaveRequest(leaveTypeId: $leaveTypeId, dateDebut: $dateDebut, dateFin: $dateFin, isHalfDay: $isHalfDay, motif: $motif) {
            success
            error
          }
        }
        '''
        create_vars = {
            "leaveTypeId": str(leave_type.id),
            "dateDebut": "2026-08-10",
            "dateFin": "2026-08-14",
            "isHalfDay": False,
            "motif": "Sick"
        }
        res = self.graphql_request(create_mutation, create_vars, token)
        self.assertFalse(res['data']['submitLeaveRequest']['success'])
        self.assertIn("pièce jointe est obligatoire", res['data']['submitLeaveRequest']['error'])

    def test_notice_period(self):
        query = '''
        mutation TokenAuth($username: String!, $password: String!) {
          tokenAuth(username: $username, password: $password) { token }
        }
        '''
        res = self.graphql_request(query, {'username': 'employee', 'password': 'password123'})
        token = res['data']['tokenAuth']['token']

        leave_type = LeaveType.objects.get(libelle='Congé Payé')
        create_mutation = '''
        mutation SubmitLeave($leaveTypeId: ID!, $dateDebut: Date!, $dateFin: Date!, $isHalfDay: Boolean!, $motif: String!) {
          submitLeaveRequest(leaveTypeId: $leaveTypeId, dateDebut: $dateDebut, dateFin: $dateFin, isHalfDay: $isHalfDay, motif: $motif) {
            success
            error
          }
        }
        '''
        from datetime import date, timedelta
        tomorrow = (date.today() + timedelta(days=1)).strftime("%Y-%m-%d")
        create_vars = {
            "leaveTypeId": str(leave_type.id),
            "dateDebut": tomorrow,
            "dateFin": tomorrow,
            "isHalfDay": False,
            "motif": "Urgent"
        }
        res = self.graphql_request(create_mutation, create_vars, token)
        self.assertFalse(res['data']['submitLeaveRequest']['success'])
        self.assertIn("délai de préavis pour un Congé Payé est de 7 jours", res['data']['submitLeaveRequest']['error'])

    def test_cancellation(self):
        def login(username, password="password123"):
            query = '''
            mutation TokenAuth($username: String!, $password: String!) {
              tokenAuth(username: $username, password: $password) { token }
            }
            '''
            res = self.graphql_request(query, {'username': username, 'password': password})
            return res['data']['tokenAuth']['token']
            
        employee_token = login('employee')
        manager_token = login('manager')
        rh_token = login('rh')
        
        # 1. Submit leave
        leave_type = LeaveType.objects.get(libelle='Congé Payé')
        create_mutation = '''
        mutation SubmitLeave($leaveTypeId: ID!, $dateDebut: Date!, $dateFin: Date!, $isHalfDay: Boolean!, $motif: String!) {
          submitLeaveRequest(leaveTypeId: $leaveTypeId, dateDebut: $dateDebut, dateFin: $dateFin, isHalfDay: $isHalfDay, motif: $motif) {
            success
            leaveRequest { id statut }
          }
        }
        '''
        create_vars = {
            "leaveTypeId": str(leave_type.id),
            "dateDebut": "2026-09-10",
            "dateFin": "2026-09-14",
            "isHalfDay": False,
            "motif": "To cancel later"
        }
        res = self.graphql_request(create_mutation, create_vars, employee_token)
        leave_request_id = res['data']['submitLeaveRequest']['leaveRequest']['id']
        
        # 2. Manager approves
        approve_mutation = '''
        mutation ProcessApproval($leaveRequestId: ID!, $decision: String!, $commentaire: String) {
          processApproval(leaveRequestId: $leaveRequestId, decision: $decision, commentaire: $commentaire) {
            success
            leaveRequest { statut }
          }
        }
        '''
        self.graphql_request(approve_mutation, {"leaveRequestId": leave_request_id, "decision": "APPROUVE", "commentaire": ""}, manager_token)
        
        # Initial balance
        initial_balance = Employee.objects.get(username='employee').solde_conges
        
        # 3. RH approves -> Balance is deducted
        self.graphql_request(approve_mutation, {"leaveRequestId": leave_request_id, "decision": "APPROUVE", "commentaire": ""}, rh_token)
        
        deducted_balance = Employee.objects.get(username='employee').solde_conges
        # From Sept 10 (Thursday) to Sept 14 (Monday).
        # Thu(1), Fri(1), Sat(0 - 1st saturday), Sun(0), Mon(1) = 3 days deducted.
        self.assertEqual(deducted_balance, initial_balance - 3)
        
        # 4. Employee requests cancellation -> EN_ATTENTE_ANNULATION
        cancel_mutation = '''
        mutation CancelLeaveRequest($leaveRequestId: ID!) {
          cancelLeaveRequest(leaveRequestId: $leaveRequestId) {
            success
            leaveRequest { statut }
          }
        }
        '''
        res = self.graphql_request(cancel_mutation, {"leaveRequestId": leave_request_id}, employee_token)
        self.assertEqual(res['data']['cancelLeaveRequest']['leaveRequest']['statut'], 'EN_ATTENTE_ANNULATION')
        
        # 5. RH approves cancellation -> ANNULE, balance refunded
        res = self.graphql_request(approve_mutation, {"leaveRequestId": leave_request_id, "decision": "APPROUVE", "commentaire": "Annulation acceptée"}, rh_token)
        self.assertEqual(res['data']['processApproval']['leaveRequest']['statut'], 'ANNULE')
        
        refunded_balance = Employee.objects.get(username='employee').solde_conges
        self.assertEqual(refunded_balance, initial_balance)

    def test_hr_balance_adjustment(self):
        # 1. Login as RH
        query = '''
        mutation TokenAuth($username: String!, $password: String!) {
          tokenAuth(username: $username, password: $password) { token }
        }
        '''
        res = self.graphql_request(query, {'username': 'rh', 'password': 'password123'})
        rh_token = res['data']['tokenAuth']['token']
        
        # 2. Login as Employee (for failure check)
        res = self.graphql_request(query, {'username': 'employee', 'password': 'password123'})
        emp_token = res['data']['tokenAuth']['token']
        
        # Initial balance
        employee = Employee.objects.get(username='employee')
        initial_balance = employee.solde_conges
        
        adjust_mutation = '''
        mutation AdjustBalance($empId: ID!, $days: Float!, $reason: String!) {
          adjustEmployeeBalance(employeeId: $empId, days: $days, reason: $reason) {
            success
            error
          }
        }
        '''
        
        # 3. Employee tries to adjust balance (should fail)
        res = self.graphql_request(adjust_mutation, {'empId': str(employee.id), 'days': 5.0, 'reason': 'Bonus'}, emp_token)
        self.assertFalse(res['data']['adjustEmployeeBalance']['success'])
        self.assertEqual(res['data']['adjustEmployeeBalance']['error'], "Seul un RH ou un Administrateur peut ajuster le solde.")
        
        # 4. RH tries to adjust balance (should succeed)
        res = self.graphql_request(adjust_mutation, {'empId': str(employee.id), 'days': 5.0, 'reason': 'Bonus Performance'}, rh_token)
        self.assertTrue(res['data']['adjustEmployeeBalance']['success'])
        
        # 5. Verify database updates
        employee.refresh_from_db()
        from decimal import Decimal
        self.assertEqual(employee.solde_conges, initial_balance + Decimal('5.00'))
        
        # 6. Verify AuditLog
        from apps.core.models import AuditLog
        log = AuditLog.objects.filter(action=AuditLog.Action.ADJUST_BALANCE, target_employee_id=employee.id).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.details, 'Bonus Performance')
        self.assertEqual(Decimal(log.nouveau_statut) - Decimal(log.ancien_statut), Decimal('5.00'))

    def test_rh_analytics_query(self):
        # 1. Login as RH
        query = '''
        mutation TokenAuth($username: String!, $password: String!) {
          tokenAuth(username: $username, password: $password) { token }
        }
        '''
        res = self.graphql_request(query, {'username': 'rh', 'password': 'password123'})
        rh_token = res['data']['tokenAuth']['token']
        
        # 2. Login as Employee (should fail access)
        res = self.graphql_request(query, {'username': 'employee', 'password': 'password123'})
        emp_token = res['data']['tokenAuth']['token']
        
        analytics_query = '''
        query GetAnalytics {
          rhAnalytics {
            totalLeavesThisMonth
            averageBalances {
              departmentName
              averageBalance
            }
            statusCounts {
              status
              count
            }
            dayCounts {
              day
              count
            }
          }
        }
        '''
        
        # Employee should not have access
        res = self.graphql_request(analytics_query, None, emp_token)
        self.assertIsNotNone(res.get('errors'))
        self.assertIn("Accès refusé", res['errors'][0]['message'])
        
        # RH should have access
        res = self.graphql_request(analytics_query, None, rh_token)
        self.assertIsNone(res.get('errors'))
        
        data = res['data']['rhAnalytics']
        self.assertIn('totalLeavesThisMonth', data)
        self.assertIn('averageBalances', data)
        self.assertIn('statusCounts', data)
        self.assertIn('dayCounts', data)
        
        # Since we seeded users, average balance should be greater than 0
        self.assertTrue(len(data['averageBalances']) > 0)
        self.assertEqual(data['averageBalances'][0]['departmentName'], 'IT')
