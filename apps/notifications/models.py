from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.employees.models import Employee

class Notification(models.Model):
    class Type(models.TextChoices):
        SOUMISSION = 'SOUMISSION', _('Soumission')
        DECISION = 'DECISION', _('Décision')
        RAPPEL = 'RAPPEL', _('Rappel')
        CAMPAGNE = 'CAMPAGNE', _('Campagne')

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='notifications', verbose_name=_("Employé"))
    type = models.CharField(max_length=20, choices=Type.choices, verbose_name=_("Type"))
    title = models.CharField(max_length=255, default='Notification', verbose_name=_("Titre"))
    message = models.TextField(verbose_name=_("Message"))
    lu = models.BooleanField(default=False, verbose_name=_("Lu"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Créé le"))

    def __str__(self):
        return f"[{self.type}] To {self.employee}: {self.message[:20]}..."
