from django.db import migrations

def create_default_leave_types(apps, schema_editor):
    LeaveType = apps.get_model('leaves', 'LeaveType')
    if not LeaveType.objects.exists():
        LeaveType.objects.create(libelle='Congé Payé', deductible_solde=True, requires_attachment=False, notice_days=7, requires_motif=False)
        LeaveType.objects.create(libelle='Congé Sans Solde', deductible_solde=False, requires_attachment=False, notice_days=0, requires_motif=True)
        LeaveType.objects.create(libelle='Congé Exceptionnel', deductible_solde=False, requires_attachment=True, notice_days=0, requires_motif=True)
        LeaveType.objects.create(libelle='Maladie', deductible_solde=False, requires_attachment=True, notice_days=0, requires_motif=False)
        LeaveType.objects.create(libelle='Récupération', deductible_solde=False, requires_attachment=False, notice_days=0, requires_motif=False)

def reverse_leave_types(apps, schema_editor):
    pass

class Migration(migrations.Migration):

    dependencies = [
        ('leaves', '0003_leavetype_notice_days_leavetype_requires_motif'),
    ]

    operations = [
        migrations.RunPython(create_default_leave_types, reverse_code=reverse_leave_types),
    ]
