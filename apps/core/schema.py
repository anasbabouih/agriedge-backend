import graphene
from graphene_django import DjangoObjectType
from graphql_jwt.decorators import login_required
from graphql_jwt.decorators import login_required
from .models import AuditLog, CompanySettings
from apps.employees.models import Employee

class AuditLogType(DjangoObjectType):
    class Meta:
        model = AuditLog
        fields = ("id", "leave_request", "action", "ancien_statut", "nouveau_statut", "timestamp", "user_id", "target_employee_id", "details")

class CompanySettingsType(DjangoObjectType):
    class Meta:
        model = CompanySettings
        fields = ("id", "overlap_threshold_percent")

class Query(graphene.ObjectType):
    all_audit_logs = graphene.List(
        AuditLogType, 
        limit=graphene.Int(), 
        offset=graphene.Int(),
        action=graphene.String(),
        search=graphene.String()
    )
    company_settings = graphene.Field(CompanySettingsType)

    @login_required
    def resolve_all_audit_logs(self, info, limit=50, offset=0, action=None, search=None):
        if info.context.user.role != Employee.Role.ADMIN:
            raise Exception("Seul un Administrateur peut consulter la piste d'audit.")
            
        qs = AuditLog.objects.all()
        if action:
            qs = qs.filter(action=action)
        if search:
            qs = qs.filter(details__icontains=search)
            
        return qs.order_by('-timestamp')[offset:offset+limit]

    @login_required
    def resolve_company_settings(self, info):
        settings, created = CompanySettings.objects.get_or_create(id=1)
        return settings

class UpdateCompanySettings(graphene.Mutation):
    class Arguments:
        overlap_threshold_percent = graphene.Int(required=True)

    success = graphene.Boolean()
    error = graphene.String()
    company_settings = graphene.Field(CompanySettingsType)

    @login_required
    def mutate(self, info, overlap_threshold_percent):
        if info.context.user.role != Employee.Role.ADMIN:
            return UpdateCompanySettings(success=False, error="Seul un Administrateur peut modifier les paramètres.")
            
        try:
            settings, created = CompanySettings.objects.get_or_create(id=1)
            settings.overlap_threshold_percent = overlap_threshold_percent
            settings.save()
            return UpdateCompanySettings(success=True, company_settings=settings)
        except Exception as e:
            return UpdateCompanySettings(success=False, error=str(e))

class Mutation(graphene.ObjectType):
    update_company_settings = UpdateCompanySettings.Field()
