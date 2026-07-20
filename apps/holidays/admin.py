from django.contrib import admin
from .models import PublicHoliday

@admin.register(PublicHoliday)
class PublicHolidayAdmin(admin.ModelAdmin):
    list_display = ('id', 'date', 'libelle')
    search_fields = ('libelle', 'date')
