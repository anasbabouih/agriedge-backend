from datetime import timedelta
from decimal import Decimal
from django.db import transaction
from django.core.exceptions import ValidationError
from apps.holidays.models import PublicHoliday
from apps.core.models import AuditLog
from apps.employees.models import Employee

def calculate_leave_days(start_date, end_date, is_half_day=False):
    """
    Algorithme de Calcul des Jours Décomptés (Section 6.1 of Blueprint)
    - Dimanche -> exclu
    - Premier samedi -> offert (exclu)
    - Samedi suivant -> comptabilisé (si non férié)
    - Jours fériés -> exclus
    - Demi-journée -> 0.5 (si 1 seul jour et comptabilisable)
    """
    if start_date > end_date:
        return Decimal('0.00')

    # Get all holidays within the range
    holidays = set(PublicHoliday.objects.filter(
        date__gte=start_date,
        date__lte=end_date
    ).values_list('date', flat=True))

    total_days = Decimal('0.00')
    current_date = start_date
    first_saturday_encountered = False

    while current_date <= end_date:
        is_sunday = current_date.weekday() == 6
        is_saturday = current_date.weekday() == 5
        is_holiday = current_date in holidays

        if is_sunday or is_holiday:
            pass # Excluded
        elif is_saturday:
            if not first_saturday_encountered:
                first_saturday_encountered = True
                # First saturday is offered, so we don't add to total
            else:
                total_days += Decimal('1.00')
        else:
            # Regular weekday
            total_days += Decimal('1.00')

        current_date += timedelta(days=1)

    # Handle half day logic
    if is_half_day and start_date == end_date and total_days == Decimal('1.00'):
        total_days = Decimal('0.50')

    return total_days

def create_audit_log(leave_request, action, user_id, old_status=None, new_status=None):
    AuditLog.objects.create(
        leave_request=leave_request,
        action=action,
        ancien_statut=old_status,
        nouveau_statut=new_status,
        user_id=user_id
    )

@transaction.atomic
def submit_leave_request(leave_request, user, is_emergency=False, is_draft=False):
    """
    Submits a draft request to N1, or keeps it as a draft if is_draft=True.
    """
    from datetime import date
    
    if leave_request.statut not in ['BROUILLON', 'REFUSE']:
        raise ValidationError("Seules les demandes en brouillon ou refusées peuvent être soumises.")
        
    # Date sanity checks
    if leave_request.date_fin < leave_request.date_debut:
        raise ValidationError("La date de fin ne peut pas être antérieure à la date de début.")
    if leave_request.date_debut < date.today():
        raise ValidationError("La date de début ne peut pas être dans le passé.")
    
    # Validation 1: Attachment required for specific leave types
    if leave_request.leave_type.requires_attachment and not leave_request.piece_jointe:
        raise ValidationError("Une pièce jointe est obligatoire pour ce type de congé.")
        
    # Validation 2: Motif required for certain types (Dynamic)
    if leave_request.leave_type.requires_motif and not leave_request.motif:
        raise ValidationError(f"Un motif est obligatoire pour un {leave_request.leave_type.libelle}.")
        
    # Validation 3: Notice period (Dynamic)
    if leave_request.leave_type.notice_days > 0 and not is_emergency:
        delta = (leave_request.date_debut - date.today()).days
        if delta < leave_request.leave_type.notice_days:
            raise ValidationError(f"Le délai de préavis pour ce type de congé est de {leave_request.leave_type.notice_days} jours minimum (sauf dérogation urgence).")
    
    if leave_request.leave_type.deductible_solde and leave_request.jours_decomptes > user.solde_conges:
        raise ValidationError("Solde de congés insuffisant.")
        
    old_status = leave_request.statut
    
    if is_draft:
        leave_request.statut = 'BROUILLON'
        leave_request.save()
        if old_status != 'BROUILLON':
            create_audit_log(leave_request, AuditLog.Action.UPDATE_STATUS, user.id, old_status, leave_request.statut)
    else:
        leave_request.statut = 'EN_ATTENTE_N1'
        leave_request.save()
        create_audit_log(leave_request, AuditLog.Action.UPDATE_STATUS, user.id, old_status, leave_request.statut)
        
        # Trigger background email for submission
        from apps.notifications.tasks import send_status_email
        send_status_email.delay(leave_request.id, 'SUBMIT')
    
    return leave_request

@transaction.atomic
def process_approval(leave_request, approver, decision, commentaire=""):
    """
    Processes an approval step (N1 or RH).
    """
    from .models import Approval, LeaveRequest # Import here to avoid circular imports if needed

    old_status = leave_request.statut
    
    if old_status == LeaveRequest.Status.EN_ATTENTE_N1:
        if approver.role != Employee.Role.MANAGER_N1 and approver.role != Employee.Role.ADMIN:
            raise ValidationError("Seul un Manager N1 peut valider cette étape.")
        niveau = Approval.Level.N1
        if decision == Approval.Decision.APPROUVE:
            new_status = LeaveRequest.Status.EN_ATTENTE_RH
            email_action = 'APPROVE_N1'
            
            # Team overlapping check (50% capacity)
            if leave_request.employee.department:
                dept = leave_request.employee.department
                total_dept_members = dept.employees.count()
                
                # Count overlapping approved/pending_RH leaves in the same department
                overlapping = LeaveRequest.objects.filter(
                    employee__department=dept,
                    statut__in=[LeaveRequest.Status.EN_ATTENTE_RH, LeaveRequest.Status.VALIDE],
                    date_debut__lte=leave_request.date_fin,
                    date_fin__gte=leave_request.date_debut
                ).exclude(id=leave_request.id).values('employee_id').distinct().count()
                
                # Adding 1 for the current request
                from apps.core.models import CompanySettings
                settings = CompanySettings.objects.first()
                threshold_percent = settings.overlap_threshold_percent if settings else 50
                
                if total_dept_members > 0 and (overlapping + 1) / total_dept_members > (threshold_percent / 100.0):
                    raise ValidationError(f"L'approbation dépasse la capacité de l'équipe (plus de {threshold_percent}% en congé simultané).")
                    
        else:
            new_status = LeaveRequest.Status.REFUSE
            email_action = 'REJECT_N1'
            
    elif old_status == LeaveRequest.Status.EN_ATTENTE_RH:
        if approver.role != Employee.Role.RH and approver.role != Employee.Role.ADMIN:
            raise ValidationError("Seul un RH peut valider cette étape.")
        niveau = Approval.Level.RH
        if decision == Approval.Decision.APPROUVE:
            new_status = LeaveRequest.Status.VALIDE
            email_action = 'APPROVE_RH'
            
            # Deduct balance if approved and deductible
            if leave_request.leave_type.deductible_solde:
                employee = leave_request.employee
                employee.solde_conges -= leave_request.jours_decomptes
                employee.save()
                create_audit_log(leave_request, AuditLog.Action.ADJUST_BALANCE, approver.id)
                
                # Check low balance alert
                if employee.solde_conges < Decimal('3.00'):
                    from apps.notifications.tasks import send_low_balance_alert
                    send_low_balance_alert.delay(employee.id, str(employee.solde_conges))
        else:
            new_status = LeaveRequest.Status.REFUSE
            email_action = 'REJECT_RH'
            
    elif old_status == LeaveRequest.Status.EN_ATTENTE_ANNULATION:
        if approver.role != Employee.Role.RH and approver.role != Employee.Role.ADMIN and approver.role != Employee.Role.MANAGER_N1:
            raise ValidationError("Seul un Manager N1 ou un RH peut valider cette étape.")
        niveau = Approval.Level.RH if approver.role in [Employee.Role.RH, Employee.Role.ADMIN] else Approval.Level.N1
        if decision == Approval.Decision.APPROUVE:
            new_status = LeaveRequest.Status.ANNULE
            email_action = 'CANCEL'
            
            # Refund balance if approved and deductible
            if leave_request.leave_type.deductible_solde:
                employee = leave_request.employee
                employee.solde_conges += leave_request.jours_decomptes
                employee.save()
                create_audit_log(leave_request, AuditLog.Action.ADJUST_BALANCE, approver.id)
        else:
            # If RH rejects the cancellation, it reverts to being a VALIDE leave
            new_status = LeaveRequest.Status.VALIDE
            email_action = 'REJECT_RH'
            
    else:
        raise ValidationError("La demande n'est pas en attente de validation.")
        
    Approval.objects.create(
        leave_request=leave_request,
        approver=approver,
        niveau=niveau,
        decision=decision,
        commentaire=commentaire
    )
    
    leave_request.statut = new_status
    leave_request.save()
    
    create_audit_log(leave_request, AuditLog.Action.UPDATE_STATUS, approver.id, old_status, new_status)
    
    # Trigger background email
    from apps.notifications.tasks import send_status_email
    send_status_email.delay(leave_request.id, email_action)
    
    return leave_request

@transaction.atomic
def cancel_leave_request(leave_request, user):
    """
    Allows an employee to request cancellation, or cancel it directly if not yet validated.
    """
    if leave_request.employee != user and user.role not in ['RH', 'ADMIN']:
        raise ValidationError("Vous n'êtes pas autorisé à annuler cette demande.")

    old_status = leave_request.statut

    # If it's already in a terminal state or being cancelled
    if old_status in ['ANNULE', 'CLOTURE', 'REFUSE', 'EN_ATTENTE_ANNULATION']:
        raise ValidationError("Cette demande ne peut plus être annulée.")

    if old_status == 'EN_ATTENTE_N1' or old_status == 'EN_ATTENTE_RH':
        # Cancel directly since it hasn't been approved yet
        new_status = 'ANNULE'
    elif old_status == 'VALIDE':
        # Require HR approval to cancel an approved leave
        new_status = 'EN_ATTENTE_ANNULATION'
    else:
        new_status = 'ANNULE'

    leave_request.statut = new_status
    leave_request.save()

    create_audit_log(leave_request, AuditLog.Action.UPDATE_STATUS, user.id, old_status, new_status)
    
    # Trigger background email
    from apps.notifications.tasks import send_status_email
    email_action = 'CANCEL_REQ' if new_status == 'EN_ATTENTE_ANNULATION' else 'CANCEL'
    send_status_email.delay(leave_request.id, email_action)

    return leave_request

