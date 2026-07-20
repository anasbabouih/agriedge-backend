from django.db import models
from django.utils.translation import gettext_lazy as _

class PublicHoliday(models.Model):
    date = models.DateField(unique=True, verbose_name=_("Date"))
    libelle = models.CharField(max_length=255, verbose_name=_("Libellé"))

    def __str__(self):
        return f"{self.libelle} ({self.date})"
