from django.contrib import admin
from .models import AuditLog, CompanySettings

@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ('id', 'action', 'leave_request', 'ancien_statut', 'nouveau_statut', 'timestamp', 'user_id')
    list_filter = ('action', 'timestamp')
    search_fields = ('leave_request__id',)
    readonly_fields = ('action', 'leave_request', 'ancien_statut', 'nouveau_statut', 'timestamp', 'user_id')

    def has_add_permission(self, request):
        return False # Audit logs should be immutable

    def has_change_permission(self, request, obj=None):
        return False
        
    def has_delete_permission(self, request, obj=None):
        return False

@admin.register(CompanySettings)
class CompanySettingsAdmin(admin.ModelAdmin):
    list_display = ('overlap_threshold_percent',)
    
    def has_add_permission(self, request):
        if self.model.objects.count() > 0:
            return False
        return super().has_add_permission(request)
