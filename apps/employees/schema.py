import graphene
from graphene_django import DjangoObjectType
from graphql_jwt.decorators import login_required
from .models import Employee, Department
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

class DepartmentType(DjangoObjectType):
    class Meta:
        model = Department
        fields = ("id", "nom")

class EmployeeType(DjangoObjectType):
    class Meta:
        model = Employee
        fields = ("id", "username", "email", "first_name", "last_name", "matricule", "department", "manager", "solde_conges", "role", "is_active")

class Query(graphene.ObjectType):
    me = graphene.Field(EmployeeType)
    all_employees = graphene.List(EmployeeType)
    all_departments = graphene.List(DepartmentType)

    def resolve_all_departments(self, info):
        return Department.objects.all().order_by('nom')

    def resolve_me(self, info):
        user = info.context.user
        if user.is_anonymous:
            raise Exception("Authentication required.")
        return user

    def resolve_all_employees(self, info):
        from graphql_jwt.decorators import login_required
        
        user = info.context.user
        if user.is_anonymous:
            raise Exception("Authentication required.")
            
        # Optional: restrict viewing all employees to managers, RH, and ADMIN if desired. 
        # But commonly in enterprise directories, all employees can see the directory.
        # We will return all employees.
        return Employee.objects.all().order_by('first_name')

class UpdateUserRole(graphene.Mutation):
    class Arguments:
        user_id = graphene.ID(required=True)
        role = graphene.String(required=True)
        
    success = graphene.Boolean()
    error = graphene.String()
    
    def mutate(self, info, user_id, role):
        user = info.context.user
        if user.role != Employee.Role.ADMIN:
            return UpdateUserRole(success=False, error="Seul un Administrateur peut changer les rôles.")
            
        try:
            target_user = Employee.objects.get(id=user_id)
            if role not in [choice[0] for choice in Employee.Role.choices]:
                return UpdateUserRole(success=False, error="Rôle invalide.")
                
            # Self-demotion guard
            if target_user.role == Employee.Role.ADMIN and role != Employee.Role.ADMIN:
                admin_count = Employee.objects.filter(role=Employee.Role.ADMIN, is_active=True).count()
                if admin_count <= 1:
                    return UpdateUserRole(success=False, error="Impossible de retirer le rôle Administrateur du dernier administrateur actif.")
                
            target_user.role = role
            target_user.save()
            return UpdateUserRole(success=True)
        except Exception as e:
            return UpdateUserRole(success=False, error=str(e))

class AssignManager(graphene.Mutation):
    class Arguments:
        employee_id = graphene.ID(required=True)
        manager_id = graphene.ID(required=True)
        
    success = graphene.Boolean()
    error = graphene.String()
    
    def mutate(self, info, employee_id, manager_id):
        user = info.context.user
        if user.role != Employee.Role.ADMIN:
            return AssignManager(success=False, error="Seul un Administrateur peut assigner un manager.")
            
        if employee_id == manager_id:
            return AssignManager(success=False, error="Un employé ne peut pas être son propre manager.")
            
        try:
            employee = Employee.objects.get(id=employee_id)
            manager = Employee.objects.get(id=manager_id)
            
            # Anti-Loop Check: Ensure 'employee' is not an ancestor of 'manager'
            current_manager = manager
            while current_manager is not None:
                if current_manager.id == employee.id:
                    return AssignManager(success=False, error="Boucle Hiérarchique Interdite: Cet employé est déjà un manager (direct ou indirect) du manager sélectionné.")
                current_manager = current_manager.manager
            
            employee.manager = manager
            employee.save()
            return AssignManager(success=True)
        except Exception as e:
            return AssignManager(success=False, error=str(e))

class SSOLogin(graphene.Mutation):
    class Arguments:
        id_token = graphene.String(required=True)
        
    token = graphene.String()
    success = graphene.Boolean()
    error = graphene.String()
    
    def mutate(self, info, id_token):
        from .sso import verify_sso_token
        import graphql_jwt.shortcuts
        
        try:
            # 1. Verify the OIDC token
            decoded = verify_sso_token(id_token)
            email = decoded.get('email')
            
            if not email:
                return SSOLogin(success=False, error="Le jeton SSO ne contient pas d'adresse e-mail.")
                
            # 2. Check if user exists
            user = Employee.objects.filter(email=email).first()
            if not user:
                # Optional Auto-Provisioning logic could go here
                return SSOLogin(success=False, error="Aucun compte trouvé avec cet e-mail.")
                
            # 3. Generate our internal GraphQL JWT
            token = graphql_jwt.shortcuts.get_token(user)
            
            return SSOLogin(token=token, success=True)
            
        except ValueError as e:
            # For development ONLY: If the frontend sends a mock token 'mock_google_token_rh'
            if id_token == 'mock_google_token_rh':
                user = Employee.objects.get(username='rh')
                token = graphql_jwt.shortcuts.get_token(user)
                return SSOLogin(token=token, success=True)
            if id_token == 'mock_google_token_admin':
                user = Employee.objects.get(username='admin')
                token = graphql_jwt.shortcuts.get_token(user)
                return SSOLogin(token=token, success=True)
            if id_token == 'mock_google_token_manager':
                user = Employee.objects.get(username='manager')
                token = graphql_jwt.shortcuts.get_token(user)
                return SSOLogin(token=token, success=True)
                
            return SSOLogin(success=False, error=str(e))
        except Exception as e:
            return SSOLogin(success=False, error="Erreur interne de connexion SSO.")

class CreateEmployee(graphene.Mutation):
    class Arguments:
        username = graphene.String(required=True)
        email = graphene.String(required=True)
        first_name = graphene.String(required=True)
        last_name = graphene.String(required=True)
        matricule = graphene.String(required=True)
        role = graphene.String(required=True)
        password = graphene.String(required=True)
        department_id = graphene.ID(required=False)
        manager_id = graphene.ID(required=False)

    employee = graphene.Field(EmployeeType)
    success = graphene.Boolean()
    error = graphene.String()

    @login_required
    def mutate(self, info, username, email, first_name, last_name, matricule, role, password, department_id=None, manager_id=None):
        if info.context.user.role != Employee.Role.RH and info.context.user.role != Employee.Role.ADMIN:
            return CreateEmployee(success=False, error="Non autorisé.")
            
        try:
            # We must create a dummy user instance to pass to validate_password
            temp_user = Employee(username=username, email=email, first_name=first_name, last_name=last_name)
            try:
                validate_password(password, temp_user)
            except ValidationError as e:
                return CreateEmployee(success=False, error=" ".join(e.messages))
            
            dept = Department.objects.get(id=department_id) if department_id else None
            mgr = Employee.objects.get(id=manager_id) if manager_id else None
            
            emp = Employee.objects.create_user(
                username=username,
                email=email,
                password=password,
                first_name=first_name,
                last_name=last_name,
                matricule=matricule,
                role=role,
                department=dept,
                manager=mgr
            )
            return CreateEmployee(employee=emp, success=True)
        except Exception as e:
            return CreateEmployee(success=False, error=str(e))

class UpdateEmployee(graphene.Mutation):
    class Arguments:
        employee_id = graphene.ID(required=True)
        role = graphene.String(required=False)
        department_id = graphene.ID(required=False)
        manager_id = graphene.ID(required=False)
        is_active = graphene.Boolean(required=False)

    employee = graphene.Field(EmployeeType)
    success = graphene.Boolean()
    error = graphene.String()

    @login_required
    def mutate(self, info, employee_id, role=None, department_id=None, manager_id=None, is_active=None):
        if info.context.user.role != Employee.Role.RH and info.context.user.role != Employee.Role.ADMIN:
            return UpdateEmployee(success=False, error="Non autorisé.")
            
        try:
            emp = Employee.objects.get(id=employee_id)
            if role:
                emp.role = role
            if department_id:
                emp.department = Department.objects.get(id=department_id)
            if manager_id:
                emp.manager = Employee.objects.get(id=manager_id)
            if is_active is not None:
                emp.is_active = is_active
            emp.save()
            return UpdateEmployee(employee=emp, success=True)
        except Exception as e:
            return UpdateEmployee(success=False, error=str(e))

class ChangePassword(graphene.Mutation):
    class Arguments:
        old_password = graphene.String(required=True)
        new_password = graphene.String(required=True)

    success = graphene.Boolean()
    error = graphene.String()

    @login_required
    def mutate(self, info, old_password, new_password):
        user = info.context.user
        
        if not user.check_password(old_password):
            return ChangePassword(success=False, error="L'ancien mot de passe est incorrect.")
            
        try:
            validate_password(new_password, user)
        except ValidationError as e:
            return ChangePassword(success=False, error=" ".join(e.messages))
            
        try:
            user.set_password(new_password)
            user.save()
            return ChangePassword(success=True)
        except Exception as e:
            return ChangePassword(success=False, error=str(e))

class CreateDepartment(graphene.Mutation):
    class Arguments:
        nom = graphene.String(required=True)

    department = graphene.Field(DepartmentType)
    success = graphene.Boolean()
    error = graphene.String()

    @login_required
    def mutate(self, info, nom):
        if info.context.user.role != Employee.Role.ADMIN:
            return CreateDepartment(success=False, error="Seul un Administrateur peut créer un département.")
        try:
            dept = Department.objects.create(nom=nom)
            return CreateDepartment(department=dept, success=True)
        except Exception as e:
            return CreateDepartment(success=False, error=str(e))

class UpdateDepartment(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)
        nom = graphene.String(required=True)

    department = graphene.Field(DepartmentType)
    success = graphene.Boolean()
    error = graphene.String()

    @login_required
    def mutate(self, info, id, nom):
        if info.context.user.role != Employee.Role.ADMIN:
            return UpdateDepartment(success=False, error="Seul un Administrateur peut modifier un département.")
        try:
            dept = Department.objects.get(id=id)
            dept.nom = nom
            dept.save()
            return UpdateDepartment(department=dept, success=True)
        except Exception as e:
            return UpdateDepartment(success=False, error=str(e))

class DeleteDepartment(graphene.Mutation):
    class Arguments:
        id = graphene.ID(required=True)

    success = graphene.Boolean()
    error = graphene.String()

    @login_required
    def mutate(self, info, id):
        if info.context.user.role != Employee.Role.ADMIN:
            return DeleteDepartment(success=False, error="Seul un Administrateur peut supprimer un département.")
        try:
            dept = Department.objects.get(id=id)
            dept.delete()
            return DeleteDepartment(success=True)
        except Exception as e:
            return DeleteDepartment(success=False, error=str(e))

class Mutation(graphene.ObjectType):
    update_user_role = UpdateUserRole.Field()
    assign_manager = AssignManager.Field()
    sso_login = SSOLogin.Field()
    create_employee = CreateEmployee.Field()
    update_employee = UpdateEmployee.Field()
    change_password = ChangePassword.Field()
    create_department = CreateDepartment.Field()
    update_department = UpdateDepartment.Field()
    delete_department = DeleteDepartment.Field()
