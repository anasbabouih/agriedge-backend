import graphene
from graphene_django import DjangoObjectType
from graphql_jwt.decorators import login_required
from django.db import models
from .models import LeaveType, LeaveRequest, Approval
from .services import calculate_leave_days, submit_leave_request, process_approval, cancel_leave_request
from graphene_file_upload.scalars import Upload

class LeaveTypeType(DjangoObjectType):
    class Meta:
        model = LeaveType
        fields = ("id", "libelle", "deductible_solde", "requires_attachment", "requires_motif", "notice_days")

class LeaveRequestType(DjangoObjectType):
    overlapping_leaves_count = graphene.Int()

    class Meta:
        model = LeaveRequest
        fields = "__all__"

    def resolve_overlapping_leaves_count(self, info):
        # Calculate how many other users in the SAME department are on leave during this request's dates.
        # "On leave" means statut is VALIDE or EN_ATTENTE_RH (approved by N1).
        if not self.employee.department:
            return 0
        
        dept = self.employee.department
        overlapping = LeaveRequest.objects.filter(
            employee__department=dept,
            statut__in=['EN_ATTENTE_RH', 'VALIDE'],
            date_debut__lte=self.date_fin,
            date_fin__gte=self.date_debut
        ).exclude(id=self.id).values('employee_id').distinct().count()
        return overlapping

class SubmitLeaveRequest(graphene.Mutation):
    class Arguments:
        leave_type_id = graphene.ID(required=True)
        date_debut = graphene.Date(required=True)
        date_fin = graphene.Date(required=True)
        is_half_day = graphene.Boolean(default_value=False)
        motif = graphene.String(required=False)
        piece_jointe = Upload(required=False)
        is_draft = graphene.Boolean(default_value=False)
        is_emergency = graphene.Boolean(default_value=False)

    leave_request = graphene.Field(LeaveRequestType)
    success = graphene.Boolean()
    error = graphene.String()

    @login_required
    def mutate(self, info, leave_type_id, date_debut, date_fin, is_half_day=False, motif="", piece_jointe=None, is_draft=False, is_emergency=False):
        user = info.context.user
        try:
            leave_type = LeaveType.objects.get(id=leave_type_id)
            jours_decomptes = calculate_leave_days(date_debut, date_fin, is_half_day)
            
            leave_request = LeaveRequest.objects.create(
                employee=user,
                leave_type=leave_type,
                date_debut=date_debut,
                date_fin=date_fin,
                jours_decomptes=jours_decomptes,
                motif=motif,
                statut='BROUILLON',
                piece_jointe=piece_jointe
            )
            
            submit_leave_request(leave_request, user, is_emergency=is_emergency, is_draft=is_draft)
            
            return SubmitLeaveRequest(leave_request=leave_request, success=True)
        except Exception as e:
            return SubmitLeaveRequest(success=False, error=str(e))

class UpdateLeaveRequest(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)
        leave_type_id = graphene.ID(required=False)
        date_debut = graphene.Date(required=False)
        date_fin = graphene.Date(required=False)
        is_half_day = graphene.Boolean(required=False)
        motif = graphene.String(required=False)
        piece_jointe = Upload(required=False)
        is_draft = graphene.Boolean(default_value=False)
        is_emergency = graphene.Boolean(default_value=False)

    leave_request = graphene.Field(LeaveRequestType)
    success = graphene.Boolean()
    error = graphene.String()

    @login_required
    def mutate(self, info, id, is_draft=False, is_emergency=False, **kwargs):
        user = info.context.user
        try:
            leave_request = LeaveRequest.objects.get(id=id, employee=user)
            
            if leave_request.statut not in ['BROUILLON', 'REFUSE']:
                raise Exception("Seuls les brouillons et les demandes refusées peuvent être modifiés.")

            if 'leave_type_id' in kwargs and kwargs['leave_type_id'] is not None:
                leave_request.leave_type = LeaveType.objects.get(id=kwargs['leave_type_id'])
            if 'date_debut' in kwargs and kwargs['date_debut'] is not None:
                leave_request.date_debut = kwargs['date_debut']
            if 'date_fin' in kwargs and kwargs['date_fin'] is not None:
                leave_request.date_fin = kwargs['date_fin']
            if 'is_half_day' in kwargs and kwargs['is_half_day'] is not None:
                is_half_day = kwargs['is_half_day']
            else:
                is_half_day = False
            if 'motif' in kwargs and kwargs['motif'] is not None:
                leave_request.motif = kwargs['motif']
            if 'piece_jointe' in kwargs and kwargs['piece_jointe'] is not None:
                leave_request.piece_jointe = kwargs['piece_jointe']

            leave_request.jours_decomptes = calculate_leave_days(leave_request.date_debut, leave_request.date_fin, is_half_day)
            
            # If it was refused, we put it back in draft first so submit_leave_request works
            leave_request.statut = 'BROUILLON'
            leave_request.save()
            
            submit_leave_request(leave_request, user, is_emergency=is_emergency, is_draft=is_draft)
            
            return UpdateLeaveRequest(leave_request=leave_request, success=True)
        except Exception as e:
            return UpdateLeaveRequest(success=False, error=str(e))

class ProcessApproval(graphene.Mutation):
    class Arguments:
        leave_request_id = graphene.ID(required=True)
        decision = graphene.String(required=True) # APPROUVE or REFUSE
        commentaire = graphene.String(required=False)

    leave_request = graphene.Field(LeaveRequestType)
    success = graphene.Boolean()
    error = graphene.String()

    @login_required
    def mutate(self, info, leave_request_id, decision, commentaire=""):
        user = info.context.user
        try:
            leave_request = LeaveRequest.objects.get(id=leave_request_id)
            process_approval(leave_request, user, decision, commentaire)
            return ProcessApproval(leave_request=leave_request, success=True)
        except Exception as e:
            return ProcessApproval(success=False, error=str(e))

class CancelLeaveRequest(graphene.Mutation):
    class Arguments:
        leave_request_id = graphene.ID(required=True)

    leave_request = graphene.Field(LeaveRequestType)
    success = graphene.Boolean()
    error = graphene.String()

    @login_required
    def mutate(self, info, leave_request_id):
        user = info.context.user
        try:
            leave_request = LeaveRequest.objects.get(id=leave_request_id)
            cancel_leave_request(leave_request, user)
            return CancelLeaveRequest(leave_request=leave_request, success=True)
        except Exception as e:
            return CancelLeaveRequest(success=False, error=str(e))

# --- ANALYTICS TYPES ---
class DepartmentBalanceType(graphene.ObjectType):
    departmentName = graphene.String()
    averageBalance = graphene.Float()

class StatusCountType(graphene.ObjectType):
    status = graphene.String()
    count = graphene.Int()

class DayOfWeekCountType(graphene.ObjectType):
    day = graphene.String()
    count = graphene.Int()

class BurnoutRiskEmployeeType(graphene.ObjectType):
    employeeId = graphene.ID()
    firstName = graphene.String()
    lastName = graphene.String()
    departmentName = graphene.String()
    soldeConges = graphene.Float()
    daysSinceLastLeave = graphene.Int()

class RHAnalyticsType(graphene.ObjectType):
    averageBalances = graphene.List(DepartmentBalanceType)
    statusCounts = graphene.List(StatusCountType)
    dayCounts = graphene.List(DayOfWeekCountType)
    totalLeavesThisMonth = graphene.Int()
    burnoutRiskEmployees = graphene.List(BurnoutRiskEmployeeType)

class ManagerDashboardStatsType(graphene.ObjectType):
    pendingN1Count = graphene.Int()
    absentTodayCount = graphene.Int()
    staleRequestsCount = graphene.Int()

class Query(graphene.ObjectType):
    leave_types = graphene.List(LeaveTypeType)
    my_requests = graphene.List(LeaveRequestType)
    leave_request = graphene.Field(LeaveRequestType, id=graphene.ID(required=True))
    pending_approvals = graphene.List(LeaveRequestType)
    calculate_days = graphene.Float(
        start_date=graphene.Date(required=True), 
        end_date=graphene.Date(required=True), 
        is_half_day=graphene.Boolean(default_value=False)
    )
    rh_analytics = graphene.Field(RHAnalyticsType)
    manager_dashboard_stats = graphene.Field(ManagerDashboardStatsType)
    all_leaves_calendar = graphene.List(LeaveRequestType)
    
    # Notification summary for polling
    pending_validations_count = graphene.Int()

    def resolve_leave_types(self, info):
        return LeaveType.objects.all()

    @login_required
    def resolve_my_requests(self, info):
        return LeaveRequest.objects.filter(employee=info.context.user)
        
    @login_required
    def resolve_leave_request(self, info, id):
        try:
            return LeaveRequest.objects.get(id=id, employee=info.context.user)
        except LeaveRequest.DoesNotExist:
            return None
        
    @login_required
    def resolve_pending_approvals(self, info):
        user = info.context.user
        from apps.employees.models import Employee
        
        if user.role == Employee.Role.MANAGER_N1 or user.role == Employee.Role.ADMIN:
            # Manager sees requests from employees they manage that are EN_ATTENTE_N1 or EN_ATTENTE_ANNULATION
            return LeaveRequest.objects.filter(
                employee__manager=user,
                statut__in=['EN_ATTENTE_N1', 'EN_ATTENTE_ANNULATION']
            )
        elif user.role == Employee.Role.RH:
            # RH sees requests that are EN_ATTENTE_RH or EN_ATTENTE_ANNULATION
            return LeaveRequest.objects.filter(
                statut__in=['EN_ATTENTE_RH', 'EN_ATTENTE_ANNULATION']
            )
        elif user.role == Employee.Role.DIRECTEUR_GENERAL:
            # DG sees ALL requests that are pending (N1, RH, or ANNULATION)
            return LeaveRequest.objects.filter(
                statut__in=['EN_ATTENTE_N1', 'EN_ATTENTE_RH', 'EN_ATTENTE_ANNULATION']
            )
            
        return LeaveRequest.objects.none()
        
    @login_required
    def resolve_all_leaves_calendar(self, info):
        user = info.context.user
        from apps.employees.models import Employee
        
        # If user is ADMIN or RH, they see everything
        if user.role in [Employee.Role.RH, Employee.Role.ADMIN, Employee.Role.DIRECTEUR_GENERAL]:
            return LeaveRequest.objects.exclude(statut=LeaveRequest.Status.BROUILLON)
            
        # If user is Manager, they see their subordinates + themselves
        if user.role == Employee.Role.MANAGER_N1:
            subordinates = user.subordinates.all()
            return LeaveRequest.objects.filter(models.Q(employee__in=subordinates) | models.Q(employee=user)).exclude(statut=LeaveRequest.Status.BROUILLON)
            
        # If normal employee, they just see their own (the calendar is primarily for managers)
        return LeaveRequest.objects.filter(employee=user).exclude(statut=LeaveRequest.Status.BROUILLON)

    @login_required
    def resolve_calculate_days(self, info, start_date, end_date, is_half_day=False):
        return float(calculate_leave_days(start_date, end_date, is_half_day))

    @login_required
    def resolve_pending_validations_count(self, info):
        user = info.context.user
        from apps.employees.models import Employee
        
        if user.role == Employee.Role.MANAGER_N1:
            subordinates = user.subordinates.all()
            return LeaveRequest.objects.filter(employee__in=subordinates, statut=LeaveRequest.Status.EN_ATTENTE_N1).count()
        elif user.role in [Employee.Role.RH, Employee.Role.ADMIN]:
            return LeaveRequest.objects.filter(statut=LeaveRequest.Status.EN_ATTENTE_RH).count()
        return 0

    @login_required
    def resolve_rh_analytics(self, info):
        user = info.context.user
        from apps.employees.models import Employee
        if user.role not in [Employee.Role.RH, Employee.Role.ADMIN]:
            raise Exception("Accès refusé.")

        from django.db.models import Avg, Count
        from django.db.models.functions import ExtractWeekDay
        from django.utils import timezone

        # 1. Average balance by department
        # We filter out users without a department
        dept_balances = Employee.objects.filter(department__isnull=False).values('department__nom').annotate(avg_balance=Avg('solde_conges'))
        average_balances = [
            DepartmentBalanceType(departmentName=item['department__nom'], averageBalance=float(item['avg_balance'] or 0))
            for item in dept_balances
        ]

        # 2. Leaves by status
        status_counts_qs = LeaveRequest.objects.values('statut').annotate(count=Count('id'))
        status_counts = [
            StatusCountType(status=item['statut'], count=item['count'])
            for item in status_counts_qs
        ]

        # 3. Day of week count (1 = Sunday, 7 = Saturday in Django ExtractWeekDay)
        day_names = {1: 'Dimanche', 2: 'Lundi', 3: 'Mardi', 4: 'Mercredi', 5: 'Jeudi', 6: 'Vendredi', 7: 'Samedi'}
        day_counts_qs = LeaveRequest.objects.annotate(day_of_week=ExtractWeekDay('date_debut')).values('day_of_week').annotate(count=Count('id'))
        day_counts = [
            DayOfWeekCountType(day=day_names.get(item['day_of_week'], 'Inconnu'), count=item['count'])
            for item in day_counts_qs
        ]

        # 4. Total leaves this month
        now = timezone.now()
        total_leaves_this_month = LeaveRequest.objects.filter(created_at__year=now.year, created_at__month=now.month).count()

        # 5. Burnout risk: balance > 20 days OR no approved leave in last 6 months
        import datetime
        six_months_ago = timezone.now() - datetime.timedelta(days=180)
        burnout_risk = []
        for emp in Employee.objects.filter(is_active=True):
            last_approved = LeaveRequest.objects.filter(
                employee=emp, statut='VALIDE'
            ).order_by('-date_fin').first()
            days_since = None
            if last_approved:
                days_since = (timezone.now().date() - last_approved.date_fin).days
            else:
                days_since = 999  # never took leave
            
            if float(emp.solde_conges) > 20 or days_since > 180:
                burnout_risk.append(BurnoutRiskEmployeeType(
                    employeeId=emp.id,
                    firstName=emp.first_name,
                    lastName=emp.last_name,
                    departmentName=emp.department.nom if emp.department else 'N/A',
                    soldeConges=float(emp.solde_conges),
                    daysSinceLastLeave=days_since
                ))

        return RHAnalyticsType(
            averageBalances=average_balances,
            statusCounts=status_counts,
            dayCounts=day_counts,
            totalLeavesThisMonth=total_leaves_this_month,
            burnoutRiskEmployees=burnout_risk
        )

    @login_required
    def resolve_manager_dashboard_stats(self, info):
        user = info.context.user
        from apps.employees.models import Employee
        from django.utils import timezone
        import datetime
        
        if user.role != Employee.Role.MANAGER_N1 and user.role != Employee.Role.ADMIN:
            raise Exception("Accès réservé aux managers.")
            
        subordinates = user.subordinates.all()
        
        # 1. Pending N1 count
        pending_n1 = LeaveRequest.objects.filter(employee__in=subordinates, statut='EN_ATTENTE_N1').count()
        
        # 2. Absent today
        today = timezone.now().date()
        absent_today = LeaveRequest.objects.filter(
            employee__in=subordinates,
            statut='VALIDE',
            date_debut__lte=today,
            date_fin__gte=today
        ).values('employee_id').distinct().count()
        
        # 3. Stale requests (inactive > 3 days)
        three_days_ago = timezone.now() - datetime.timedelta(days=3)
        stale_requests = LeaveRequest.objects.filter(
            employee__in=subordinates,
            statut='EN_ATTENTE_N1',
            created_at__lt=three_days_ago
        ).count()
        
        return ManagerDashboardStatsType(
            pendingN1Count=pending_n1,
            absentTodayCount=absent_today,
            staleRequestsCount=stale_requests
        )

class AdjustEmployeeBalance(graphene.Mutation):
    class Arguments:
        employee_id = graphene.ID(required=True)
        days = graphene.Float(required=True)
        reason = graphene.String(required=True)

    success = graphene.Boolean()
    error = graphene.String()

    @login_required
    def mutate(self, info, employee_id, days, reason):
        user = info.context.user
        from apps.employees.models import Employee
        
        if user.role not in [Employee.Role.RH, Employee.Role.ADMIN]:
            return AdjustEmployeeBalance(success=False, error="Seul un RH ou un Administrateur peut ajuster le solde.")
            
        try:
            target_employee = Employee.objects.get(id=employee_id)
            old_balance = target_employee.solde_conges
            
            from decimal import Decimal
            target_employee.solde_conges += Decimal(str(days))
            target_employee.save()
            
            new_balance = target_employee.solde_conges
            
            from apps.core.models import AuditLog
            AuditLog.objects.create(
                action=AuditLog.Action.ADJUST_BALANCE,
                ancien_statut=str(old_balance),
                nouveau_statut=str(new_balance),
                user_id=user.id,
                target_employee_id=target_employee.id,
                details=reason
            )
            return AdjustEmployeeBalance(success=True)
        except Exception as e:
            return AdjustEmployeeBalance(success=False, error=str(e))

class CreateLeaveType(graphene.Mutation):
    class Arguments:
        libelle = graphene.String(required=True)
        description = graphene.String(required=False)
        plafond_jours = graphene.Decimal(required=False)
        accumulation_mensuelle = graphene.Decimal(required=False)
        deductible_solde = graphene.Boolean(required=False)
        requires_attachment = graphene.Boolean(required=False)

    leave_type = graphene.Field(LeaveTypeType)
    success = graphene.Boolean()
    error = graphene.String()

    @login_required
    def mutate(self, info, libelle, description="", plafond_jours=None, accumulation_mensuelle=None, deductible_solde=True, requires_attachment=False):
        from apps.employees.models import Employee
        if info.context.user.role != Employee.Role.ADMIN:
            return CreateLeaveType(success=False, error="Seul un Administrateur peut créer un type de congé.")
            
        try:
            leave_type = LeaveType.objects.create(
                libelle=libelle,
                description=description,
                plafond_jours=plafond_jours,
                accumulation_mensuelle=accumulation_mensuelle,
                deductible_solde=deductible_solde,
                requires_attachment=requires_attachment
            )
            return CreateLeaveType(leave_type=leave_type, success=True)
        except Exception as e:
            return CreateLeaveType(success=False, error=str(e))

class UpdateLeaveType(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)
        libelle = graphene.String(required=False)
        description = graphene.String(required=False)
        plafond_jours = graphene.Decimal(required=False)
        accumulation_mensuelle = graphene.Decimal(required=False)
        deductible_solde = graphene.Boolean(required=False)
        requires_attachment = graphene.Boolean(required=False)

    leave_type = graphene.Field(LeaveTypeType)
    success = graphene.Boolean()
    error = graphene.String()

    @login_required
    def mutate(self, info, id, **kwargs):
        from apps.employees.models import Employee
        if info.context.user.role != Employee.Role.ADMIN:
            return UpdateLeaveType(success=False, error="Seul un Administrateur peut modifier un type de congé.")
            
        try:
            leave_type = LeaveType.objects.get(id=id)
            for key, value in kwargs.items():
                if value is not None:
                    setattr(leave_type, key, value)
            leave_type.save()
            return UpdateLeaveType(leave_type=leave_type, success=True)
        except Exception as e:
            return UpdateLeaveType(success=False, error=str(e))

class DeleteLeaveType(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)

    success = graphene.Boolean()
    error = graphene.String()

    @login_required
    def mutate(self, info, id):
        from apps.employees.models import Employee
        if info.context.user.role != Employee.Role.ADMIN:
            return DeleteLeaveType(success=False, error="Seul un Administrateur peut supprimer un type de congé.")
            
        try:
            # Check if there are associated leave requests
            leave_type = LeaveType.objects.get(id=id)
            if leave_type.requests.exists():
                return DeleteLeaveType(success=False, error="Impossible de supprimer ce type de congé car il est utilisé par des demandes existantes.")
                
            leave_type.delete()
            return DeleteLeaveType(success=True)
        except Exception as e:
            return DeleteLeaveType(success=False, error=str(e))

class GenerateDocumentToken(graphene.Mutation):
    class Arguments:
        leave_request_id = graphene.ID(required=True)

    token = graphene.String()
    success = graphene.Boolean()
    error = graphene.String()

    @login_required
    def mutate(self, info, leave_request_id):
        user = info.context.user
        try:
            leave_request = LeaveRequest.objects.get(id=leave_request_id)
            
            # Check permissions
            from apps.employees.models import Employee
            if leave_request.employee != user and user.role not in [Employee.Role.MANAGER_N1, Employee.Role.RH, Employee.Role.ADMIN, Employee.Role.DIRECTEUR_GENERAL]:
                return GenerateDocumentToken(success=False, error="Accès refusé.")
                
            # If Manager N1, verify it's a subordinate
            if user.role == Employee.Role.MANAGER_N1 and leave_request.employee.manager != user:
                return GenerateDocumentToken(success=False, error="Accès refusé.")
                
            if not leave_request.piece_jointe:
                return GenerateDocumentToken(success=False, error="Pas de pièce jointe.")
                
            # Generate JWT specifically for this document
            import jwt
            import datetime
            from django.conf import settings
            
            payload = {
                'leave_request_id': leave_request.id,
                'user_id': user.id,
                'exp': datetime.datetime.utcnow() + datetime.timedelta(minutes=5),
                'iat': datetime.datetime.utcnow()
            }
            
            token = jwt.encode(payload, settings.SECRET_KEY, algorithm='HS256')
            # Handle PyJWT returning bytes in older versions or string in newer
            if isinstance(token, bytes):
                token = token.decode('utf-8')
                
            return GenerateDocumentToken(token=token, success=True)
            
        except Exception as e:
            return GenerateDocumentToken(success=False, error=str(e))

class BulkProcessApproval(graphene.Mutation):
    class Arguments:
        leave_request_ids = graphene.List(graphene.ID, required=True)

    success_count = graphene.Int()
    error_count = graphene.Int()
    errors = graphene.List(graphene.String)

    @login_required
    def mutate(self, info, leave_request_ids):
        user = info.context.user
        from apps.employees.models import Employee
        if user.role not in [Employee.Role.RH, Employee.Role.ADMIN, Employee.Role.MANAGER_N1]:
            return BulkProcessApproval(success_count=0, error_count=1, errors=["Accès refusé."])

        success_count = 0
        error_list = []
        for lr_id in leave_request_ids:
            try:
                lr = LeaveRequest.objects.get(id=lr_id)
                process_approval(lr, user, 'APPROUVE', '')
                success_count += 1
            except Exception as e:
                error_list.append(f"Demande #{lr_id}: {str(e)}")

        return BulkProcessApproval(
            success_count=success_count,
            error_count=len(error_list),
            errors=error_list if error_list else None
        )

class Mutation(graphene.ObjectType):
    submit_leave_request = SubmitLeaveRequest.Field()
    update_leave_request = UpdateLeaveRequest.Field()
    process_approval = ProcessApproval.Field()
    cancel_leave_request = CancelLeaveRequest.Field()
    adjust_employee_balance = AdjustEmployeeBalance.Field()
    create_leave_type = CreateLeaveType.Field()
    update_leave_type = UpdateLeaveType.Field()
    delete_leave_type = DeleteLeaveType.Field()
    generate_document_token = GenerateDocumentToken.Field()
    bulk_process_approval = BulkProcessApproval.Field()
