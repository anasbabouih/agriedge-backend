import graphene
from graphene_django.types import DjangoObjectType
from graphql_jwt.decorators import login_required
from .models import Notification

class NotificationType(DjangoObjectType):
    title = graphene.String()
    is_read = graphene.Boolean()
    type = graphene.String()

    class Meta:
        model = Notification
        fields = "__all__"

    def resolve_title(self, info):
        return self.title or self.get_type_display()

    def resolve_is_read(self, info):
        return self.lu

    def resolve_type(self, info):
        return self.type

class MarkNotificationAsRead(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)

    success = graphene.Boolean()
    
    @login_required
    def mutate(self, info, id):
        try:
            notification = Notification.objects.get(id=id, employee=info.context.user)
            notification.lu = True
            notification.save()
            return MarkNotificationAsRead(success=True)
        except Notification.DoesNotExist:
            return MarkNotificationAsRead(success=False)

class MarkAllNotificationsRead(graphene.Mutation):
    success = graphene.Boolean()
    
    @login_required
    def mutate(self, info):
        Notification.objects.filter(employee=info.context.user, lu=False).update(lu=True)
        return MarkAllNotificationsRead(success=True)

class Query(graphene.ObjectType):
    my_notifications = graphene.List(NotificationType)

    @login_required
    def resolve_my_notifications(self, info):
        return Notification.objects.filter(employee=info.context.user).order_by('-created_at')[:20]

class Mutation(graphene.ObjectType):
    mark_notification_as_read = MarkNotificationAsRead.Field()
    mark_all_notifications_read = MarkAllNotificationsRead.Field()
