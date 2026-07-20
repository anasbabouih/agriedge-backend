import graphene
from graphene_django import DjangoObjectType
from graphql_jwt.decorators import login_required
from .models import PublicHoliday
from apps.employees.models import Employee

class PublicHolidayType(DjangoObjectType):
    class Meta:
        model = PublicHoliday
        fields = ("id", "date", "libelle")

class Query(graphene.ObjectType):
    all_holidays = graphene.List(PublicHolidayType)

    @login_required
    def resolve_all_holidays(self, info):
        return PublicHoliday.objects.all().order_by('-date')

class CreateHoliday(graphene.Mutation):
    class Arguments:
        date = graphene.Date(required=True)
        libelle = graphene.String(required=True)

    holiday = graphene.Field(PublicHolidayType)
    success = graphene.Boolean()
    error = graphene.String()

    @login_required
    def mutate(self, info, date, libelle):
        if info.context.user.role != Employee.Role.RH and info.context.user.role != Employee.Role.ADMIN:
            return CreateHoliday(success=False, error="Non autorisé.")
            
        try:
            holiday = PublicHoliday.objects.create(date=date, libelle=libelle)
            return CreateHoliday(holiday=holiday, success=True)
        except Exception as e:
            return CreateHoliday(success=False, error=str(e))

class DeleteHoliday(graphene.Mutation):
    class Arguments:
        holiday_id = graphene.ID(required=True)

    success = graphene.Boolean()
    error = graphene.String()

    @login_required
    def mutate(self, info, holiday_id):
        if info.context.user.role != Employee.Role.RH and info.context.user.role != Employee.Role.ADMIN:
            return DeleteHoliday(success=False, error="Non autorisé.")
            
        try:
            PublicHoliday.objects.get(id=holiday_id).delete()
            return DeleteHoliday(success=True)
        except PublicHoliday.DoesNotExist:
            return DeleteHoliday(success=False, error="Jour férié introuvable.")
        except Exception as e:
            return DeleteHoliday(success=False, error=str(e))

class Mutation(graphene.ObjectType):
    create_holiday = CreateHoliday.Field()
    delete_holiday = DeleteHoliday.Field()
