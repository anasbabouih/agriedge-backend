from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.employees.models import Employee

class LeaveType(models.Model):
    libelle = models.CharField(max_length=100, unique=True, verbose_name=_("Libellé"))
    deductible_solde = models.BooleanField(default=True, verbose_name=_("Déductible du solde"))
    requires_attachment = models.BooleanField(default=False, verbose_name=_("Pièce jointe obligatoire"))
    requires_motif = models.BooleanField(default=False, verbose_name=_("Motif obligatoire"))
    notice_days = models.IntegerField(default=0, verbose_name=_("Délai de préavis (jours)"))

    def __str__(self):
        return self.libelle

class LeaveRequest(models.Model):
    class Status(models.TextChoices):
        BROUILLON = 'BROUILLON', _('Brouillon')
        EN_ATTENTE_N1 = 'EN_ATTENTE_N1', _('En attente N1')
        EN_ATTENTE_RH = 'EN_ATTENTE_RH', _('En attente RH')
        VALIDE = 'VALIDE', _('Approuvée')
        REFUSE = 'REFUSE', _('Rejetée')
        EN_ATTENTE_ANNULATION = 'EN_ATTENTE_ANNULATION', _('En attente d\'annulation')
        ANNULE = 'ANNULE', _('Annulée')
        CLOTURE = 'CLOTURE', _('Clôturée')

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='leave_requests', verbose_name=_("Employé"))
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT, verbose_name=_("Type de congé"))
    date_debut = models.DateField(verbose_name=_("Date de début"))
    date_fin = models.DateField(verbose_name=_("Date de fin"))
    jours_decomptes = models.DecimalField(max_digits=5, decimal_places=2, verbose_name=_("Jours décomptés"))
    statut = models.CharField(max_length=30, choices=Status.choices, default=Status.BROUILLON, verbose_name=_("Statut"))
    motif = models.TextField(blank=True, null=True, verbose_name=_("Motif"))
    piece_jointe = models.FileField(upload_to='attachments/%Y/%m/', blank=True, null=True, verbose_name=_("Pièce jointe"))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Créé le"))

    def __str__(self):
        return f"{self.leave_type} - {self.employee} ({self.date_debut} to {self.date_fin})"

class Approval(models.Model):
    class Level(models.IntegerChoices):
        N1 = 1, _('Niveau 1 (Manager)')
        RH = 2, _('Niveau 2 (RH)')

    class Decision(models.TextChoices):
        APPROUVE = 'APPROUVE', _('Approuvé')
        REFUSE = 'REFUSE', _('Refusé')

    leave_request = models.ForeignKey(LeaveRequest, on_delete=models.CASCADE, related_name='approvals', verbose_name=_("Demande de congé"))
    approver = models.ForeignKey(Employee, on_delete=models.PROTECT, related_name='given_approvals', verbose_name=_("Approbateur"))
    niveau = models.IntegerField(choices=Level.choices, verbose_name=_("Niveau"))
    decision = models.CharField(max_length=15, choices=Decision.choices, verbose_name=_("Décision"))
    commentaire = models.TextField(blank=True, null=True, verbose_name=_("Commentaire"))
    decided_at = models.DateTimeField(auto_now_add=True, verbose_name=_("Décidé le"))

    def __str__(self):
        return f"{self.get_niveau_display()} - {self.get_decision_display()} by {self.approver}"
