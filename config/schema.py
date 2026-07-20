import graphene
import graphql_jwt

import apps.employees.schema
import apps.leaves.schema
import apps.holidays.schema
import apps.core.schema
import apps.notifications.schema

class Query(apps.employees.schema.Query, apps.leaves.schema.Query, apps.holidays.schema.Query, apps.core.schema.Query, apps.notifications.schema.Query, graphene.ObjectType):
    pass

class Mutation(apps.employees.schema.Mutation, apps.leaves.schema.Mutation, apps.holidays.schema.Mutation, apps.notifications.schema.Mutation, apps.core.schema.Mutation, graphene.ObjectType):
    token_auth = graphql_jwt.ObtainJSONWebToken.Field()
    verify_token = graphql_jwt.Verify.Field()
    refresh_token = graphql_jwt.Refresh.Field()

schema = graphene.Schema(query=Query, mutation=Mutation)
