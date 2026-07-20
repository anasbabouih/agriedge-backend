from django.contrib import admin
from .models import LeaveType, LeaveRequest, Approval

@admin.register(LeaveType)
class LeaveTypeAdmin(admin.ModelAdmin):
    list_display = ('id', 'libelle', 'deductible_solde')

@admin.register(LeaveRequest)
class LeaveRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'employee', 'leave_type', 'date_debut', 'date_fin', 'jours_decomptes', 'statut', 'created_at')
    list_filter = ('statut', 'leave_type', 'created_at')
    search_fields = ('employee__username', 'employee__matricule')

@admin.register(Approval)
class ApprovalAdmin(admin.ModelAdmin):
    list_display = ('id', 'leave_request', 'approver', 'niveau', 'decision', 'decided_at')
    list_filter = ('niveau', 'decision')
