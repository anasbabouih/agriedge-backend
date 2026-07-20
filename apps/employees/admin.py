from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import Department, Employee

@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('id', 'nom')
    search_fields = ('nom',)

@admin.register(Employee)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'matricule', 'role', 'department', 'solde_conges', 'is_staff')
    list_filter = ('role', 'department', 'is_staff', 'is_superuser', 'is_active')
    search_fields = ('username', 'first_name', 'last_name', 'email', 'matricule')
    
    fieldsets = UserAdmin.fieldsets + (
        ('AgriEdge Profile', {'fields': ('matricule', 'role', 'department', 'manager', 'solde_conges')}),
    )
    add_fieldsets = UserAdmin.add_fieldsets + (
        ('AgriEdge Profile', {'fields': ('matricule', 'role', 'department', 'manager', 'solde_conges')}),
    )
