from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.leaves.models import LeaveRequest
from django.core.exceptions import PermissionDenied

class CompanySettings(models.Model):
    overlap_threshold_percent = models.IntegerField(
        default=50, 
        verbose_name=_("Seuil d'alerte chevauchement (%)"),
        help_text=_("Pourcentage maximum d'employés d'un même département pouvant être en congé simultanément.")
    )
    
    class Meta:
        verbose_name = _("Paramètres de l'entreprise")
        verbose_name_plural = _("Paramètres de l'entreprise")
        
    def __str__(self):
        return "Configuration Globale"

class AuditLogQuerySet(models.QuerySet):
    def delete(self):
        raise PermissionDenied("Les journaux d'audit ne peuvent pas être supprimés (Conformité 5 ans).")

class AuditLogManager(models.Manager):
    def get_queryset(self):
        return AuditLogQuerySet(self.model, using=self._db)

class AuditLog(models.Model):
    class Action(models.TextChoices):
        CREATE = 'CREATE', _('Création')
        UPDATE_STATUS = 'UPDATE_STATUS', _('Mise à jour du statut')
        DELETE = 'DELETE', _('Suppression')
        ADJUST_BALANCE = 'ADJUST_BALANCE', _('Ajustement du solde')
        ACCESS_DOCUMENT = 'ACCESS_DOCUMENT', _('Accès au document')

    leave_request = models.ForeignKey(LeaveRequest, on_delete=models.SET_NULL, null=True, blank=True, related_name='audit_logs', verbose_name=_("Demande de congé"))
    action = models.CharField(max_length=50, choices=Action.choices, verbose_name=_("Action"))
    ancien_statut = models.CharField(max_length=50, blank=True, null=True, verbose_name=_("Ancien statut"))
    nouveau_statut = models.CharField(max_length=50, blank=True, null=True, verbose_name=_("Nouveau statut"))
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name=_("Horodatage"))
    user_id = models.IntegerField(blank=True, null=True, verbose_name=_("ID Utilisateur")) # Storing just the ID to prevent issues if user is deleted, good for audit
    target_employee_id = models.IntegerField(blank=True, null=True, verbose_name=_("ID Employé Cible"))
    details = models.TextField(blank=True, null=True, verbose_name=_("Détails/Motif"))

    objects = AuditLogManager()

    def delete(self, *args, **kwargs):
        raise PermissionDenied("La suppression d'un journal d'audit est strictement interdite (Conformité 5 ans).")

    def __str__(self):
        return f"{self.action} on {self.leave_request} at {self.timestamp}"
