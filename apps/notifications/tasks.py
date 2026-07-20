from celery import shared_task
from django.utils import timezone
from datetime import timedelta
from django.core.mail import EmailMessage
from icalendar import Calendar, Event
from apps.leaves.models import LeaveRequest
from apps.employees.models import Employee
from apps.notifications.models import Notification

@shared_task
def send_status_email(leave_request_id, action):
    try:
        leave_request = LeaveRequest.objects.get(id=leave_request_id)
        employee = leave_request.employee
        
        subject = f"Mise à jour de votre demande de congé #{leave_request.id}"
        message = f"Bonjour,\n\nLe statut de la demande de congé de {employee.first_name} {employee.last_name} du {leave_request.date_debut} au {leave_request.date_fin} a été mis à jour.\nNouveau statut : {leave_request.get_statut_display()}\n\nCordialement,\nL'équipe RH"
        
        recipients = set()
        
        # Route logic based on blueprint (Sheet 7)
        if action == 'SUBMIT':
            if employee.manager and employee.manager.email:
                recipients.add(employee.manager.email)
                Notification.objects.create(
                    employee=employee.manager,
                    type=Notification.Type.SOUMISSION,
                    message=f"Nouvelle demande de congé de {employee.first_name} {employee.last_name}."
                )
        elif action == 'APPROVE_N1':
            recipients.add(employee.email)
            Notification.objects.create(
                employee=employee,
                type=Notification.Type.DECISION,
                message=f"Votre demande de congé a été validée par votre N1."
            )
            for rh in Employee.objects.filter(role=Employee.Role.RH):
                if rh.email:
                    recipients.add(rh.email)
                Notification.objects.create(
                    employee=rh,
                    type=Notification.Type.SOUMISSION,
                    message=f"Demande de congé de {employee.first_name} {employee.last_name} en attente de validation RH."
                )
        elif action == 'REJECT_N1':
            recipients.add(employee.email)
            Notification.objects.create(
                employee=employee,
                type=Notification.Type.DECISION,
                message=f"Votre demande de congé a été refusée par votre N1."
            )
        elif action == 'APPROVE_RH':
            recipients.add(employee.email)
            Notification.objects.create(
                employee=employee,
                type=Notification.Type.DECISION,
                message=f"Votre demande de congé a été approuvée par les RH."
            )
            if employee.manager and employee.manager.email:
                recipients.add(employee.manager.email)
                Notification.objects.create(
                    employee=employee.manager,
                    type=Notification.Type.DECISION,
                    message=f"La demande de congé de {employee.first_name} {employee.last_name} a été approuvée par les RH."
                )
        elif action == 'REJECT_RH':
            recipients.add(employee.email)
            Notification.objects.create(
                employee=employee,
                type=Notification.Type.DECISION,
                message=f"Votre demande de congé a été refusée par les RH."
            )
            if employee.manager and employee.manager.email:
                recipients.add(employee.manager.email)
        elif action == 'CANCEL_REQ':
            if employee.manager and employee.manager.email:
                recipients.add(employee.manager.email)
            for rh in Employee.objects.filter(role=Employee.Role.RH):
                if rh.email:
                    recipients.add(rh.email)
                Notification.objects.create(
                    employee=rh,
                    type=Notification.Type.DECISION,
                    message=f"Demande d'annulation de congé de {employee.first_name} {employee.last_name}."
                )
        elif action == 'CANCEL':
            recipients.add(employee.email)
            Notification.objects.create(
                employee=employee,
                type=Notification.Type.DECISION,
                message=f"Votre demande de congé a été annulée."
            )

        if recipients:
            print(f"[CELERY] Sending email to {recipients}...")
            
            email = EmailMessage(
                subject,
                message,
                'noreply@agriedge.com',
                list(recipients)
            )
            
            # Attach ICS for calendar sync when a leave is fully approved
            if action == 'APPROVE_RH':
                cal = Calendar()
                cal.add('prodid', '-//AgriEdge Leave System//agriedge.com//')
                cal.add('version', '2.0')
                
                event = Event()
                event.add('summary', f"Congé : {employee.first_name} {employee.last_name}")
                event.add('dtstart', leave_request.date_debut)
                event.add('dtend', leave_request.date_fin + timedelta(days=1))
                event.add('description', f"Type: {leave_request.leave_type.libelle}")
                
                cal.add_component(event)
                
                email.attach('conge_approuve.ics', cal.to_ical(), 'text/calendar')
                
            email.send(fail_silently=False)
            print(f"[CELERY] Email sent successfully.")
        return True
    except LeaveRequest.DoesNotExist:
        print(f"[CELERY] LeaveRequest {leave_request_id} not found.")
        return False

@shared_task
def send_low_balance_alert(employee_id, current_balance):
    try:
        employee = Employee.objects.get(id=employee_id)
        if employee.email:
            subject = "Alerte : Solde de congés faible"
            message = f"Bonjour {employee.first_name},\n\nVotre solde de congés actuel est de {current_balance} jours. Veuillez en tenir compte pour vos prochaines demandes.\n\nCordialement,\nL'équipe RH"
            email = EmailMessage(
                subject,
                message,
                'noreply@agriedge.com',
                [employee.email]
            )
            email.send(fail_silently=True)
            
            Notification.objects.create(
                employee=employee,
                type=Notification.Type.RAPPEL,
                message=f"Alerte solde faible : il vous reste {current_balance} jours."
            )
        return True
    except Employee.DoesNotExist:
        return False

@shared_task
def accrue_monthly_leave():
    """
    Tâche périodique (Celery Beat) : acquisition mensuelle (2.17j/mois).
    """
    from decimal import Decimal
    # Exclude interns from monthly accrual (Compliance Rule 11)
    employees = Employee.objects.filter(is_intern=False)
    count = 0
    for emp in employees:
        emp.solde_conges += Decimal('2.17')
        emp.save()
        count += 1
    return f"Accrued 2.17 days to {count} employees."

@shared_task
def check_stagnant_requests():
    """
    Tâche périodique (Celery Beat) : rappel J-3.
    """
    three_days_ago = timezone.now() - timedelta(days=3)
    stagnant_requests = LeaveRequest.objects.filter(
        statut__in=[LeaveRequest.Status.EN_ATTENTE_N1, LeaveRequest.Status.EN_ATTENTE_RH],
        created_at__lte=three_days_ago
    )
    
    count = 0
    for req in stagnant_requests:
        approvers = []
        if req.statut == LeaveRequest.Status.EN_ATTENTE_N1 and req.employee.manager:
            approvers.append(req.employee.manager)
        elif req.statut == LeaveRequest.Status.EN_ATTENTE_RH:
            approvers.extend(Employee.objects.filter(role=Employee.Role.RH))
            
        for approver in approvers:
            if approver.email:
                subject = f"Rappel : Demande de congé #{req.id} en attente"
                message = f"Bonjour {approver.first_name},\n\nLa demande de congé de {req.employee.first_name} {req.employee.last_name} est en attente depuis plus de 3 jours.\nMerci de la traiter.\n\nCordialement,\nL'équipe RH"
                print(f"[CELERY BEAT] Sending reminder to {approver.email}...")
                email = EmailMessage(
                    subject,
                    message,
                    'noreply@agriedge.com',
                    [approver.email]
                )
                email.send(fail_silently=True)
                
                Notification.objects.create(
                    employee=approver,
                    type=Notification.Type.RAPPEL,
                    message=f"Rappel: Demande de {req.employee.first_name} {req.employee.last_name} en attente depuis > 3 jours."
                )
        count += 1
        
    return f"Processed {count} stagnant requests."

@shared_task
def rollover_annual_leaves():
    """
    Runs on Jan 1st.
    Rollover unused leaves. Capped at 5 days.
    """
    from decimal import Decimal
    from apps.core.models import AuditLog
    
    MAX_ROLLOVER = Decimal('5.00')
    employees = Employee.objects.filter(is_active=True)
    count = 0
    
    for emp in employees:
        if emp.solde_conges > MAX_ROLLOVER:
            old_balance = emp.solde_conges
            new_balance = MAX_ROLLOVER
            
            emp.solde_conges = new_balance
            emp.save()
            
            AuditLog.objects.create(
                action=AuditLog.Action.ADJUST_BALANCE,
                ancien_statut=str(old_balance),
                nouveau_statut=str(new_balance),
                user_id=None, 
                target_employee_id=emp.id,
                details="Rollover annuel automatique (Plafonné à 5 jours)"
            )
            count += 1
            
    return f"Rollover completed. Adjusted {count} employees."

@shared_task
def send_leave_reminders_campaign():
    """
    Campaign task: Targets employees with high balances (> 20 days) 
    and creates in-app notifications encouraging them to take time off.
    Intended to run monthly during Oct-Dec.
    """
    from decimal import Decimal
    
    HIGH_BALANCE_THRESHOLD = Decimal('20.00')
    
    employees = Employee.objects.filter(
        is_active=True,
        solde_conges__gt=HIGH_BALANCE_THRESHOLD
    )
    
    count = 0
    for emp in employees:
        # Don't spam — skip if already notified this month
        already_notified = Notification.objects.filter(
            employee=emp,
            type=Notification.Type.CAMPAGNE,
            created_at__year=timezone.now().year,
            created_at__month=timezone.now().month
        ).exists()
        
        if already_notified:
            continue
        
        Notification.objects.create(
            employee=emp,
            type=Notification.Type.CAMPAGNE,
            title="🏖️ Pensez à poser vos congés !",
            message=f"Bonjour {emp.first_name}, votre solde de congés est de {emp.solde_conges} jours. "
                    f"Nous vous encourageons à planifier vos jours de repos avant la fin de l'année pour votre bien-être."
        )
        count += 1
    
    return f"Campaign completed. Notified {count} employees."

