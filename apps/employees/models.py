from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils.translation import gettext_lazy as _

class Department(models.Model):
    nom = models.CharField(max_length=255, unique=True, verbose_name=_("Nom du département"))

    def __str__(self):
        return self.nom

class Employee(AbstractUser):
    class Role(models.TextChoices):
        EMPLOYE = 'EMPLOYE', _('Employé')
        MANAGER_N1 = 'MANAGER_N1', _('Manager N1')
        RH = 'RH', _('RH')
        ADMIN = 'ADMIN', _('Administrateur')
        DIRECTEUR_GENERAL = 'DG', _('Directeur Général')

    matricule = models.CharField(max_length=50, unique=True, verbose_name=_("Matricule"))
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name='employees', verbose_name=_("Département"))
    manager = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='subordinates', verbose_name=_("Manager N1"))
    solde_conges = models.DecimalField(max_digits=5, decimal_places=2, default=0.00, verbose_name=_("Solde de congés"))
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.EMPLOYE, verbose_name=_("Rôle"))
    is_intern = models.BooleanField(default=False, verbose_name=_("Est stagiaire"))

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.matricule})"
