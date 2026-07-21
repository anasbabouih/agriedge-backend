'use client';

import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Settings, ShieldAlert, Loader2, Edit, Save, Trash2, Check, X, Search, Building, Plus } from 'lucide-react';
import { EmployeeManagementModal } from '@/components/EmployeeManagementModal';
import { LeaveTypeModal } from '@/components/LeaveTypeModal';
import { DepartmentModal } from '@/components/DepartmentModal';
import { useToast } from '@/components/Toast';

const ADMIN_DASHBOARD_QUERY = gql`
  query GetAdminData($auditOffset: Int, $auditLimit: Int) {
    me { role }
    companySettings {
      id
      overlapThresholdPercent
    }
    allDepartments {
      id
      nom
    }
    allEmployees {
      id
      firstName
      lastName
      matricule
      email
      username
      isActive
      role
      manager { id firstName lastName }
      department { id nom }
    }
    leaveTypes {
      id
      libelle
      deductibleSolde
      requiresAttachment
      requiresMotif
      noticeDays
    }
    allAuditLogs(offset: $auditOffset, limit: $auditLimit) {
      id
      action
      ancienStatut
      nouveauStatut
      timestamp
      userId
      targetEmployeeId
      details
    }
  }
`;

const ASSIGN_MANAGER = gql`
  mutation AssignMgr($employeeId: ID!, $managerId: ID!) {
    assignManager(employeeId: $employeeId, managerId: $managerId) {
      success
      error
    }
  }
`;

const UPDATE_ROLE = gql`
  mutation UpdateRole($userId: ID!, $role: String!) {
    updateUserRole(userId: $userId, role: $role) {
      success
      error
    }
  }
`;

const UPDATE_SETTINGS = gql`
  mutation UpdateSettings($overlapThresholdPercent: Int!) {
    updateCompanySettings(overlapThresholdPercent: $overlapThresholdPercent) {
      success
      error
    }
  }
`;

const DELETE_LEAVE_TYPE = gql`
  mutation DeleteLT($id: ID!) {
    deleteLeaveType(id: $id) {
      success
      error
    }
  }
`;

const DELETE_DEPT = gql`
  mutation DeleteDept($id: ID!) {
    deleteDepartment(id: $id) {
      success
      error
    }
  }
`;

export default function AdminDashboardPage() {
  const [auditOffset, setAuditOffset] = useState(0);
  const auditLimit = 50;

  const { data, loading, error, refetch } = useQuery(ADMIN_DASHBOARD_QUERY, { 
    variables: { auditOffset, auditLimit },
    fetchPolicy: 'cache-and-network',
    errorPolicy: 'all',  // return partial data even if some fields error
  });
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState<'USERS' | 'RULES' | 'DEPARTMENTS' | 'AUDIT'>('USERS');
  
  // Modals state
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<any>(null);
  
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [selectedLeave, setSelectedLeave] = useState<any>(null);
  
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<any>(null);

  // Search state
  const [empSearch, setEmpSearch] = useState('');

  const [assignManager] = useMutation(ASSIGN_MANAGER);
  const [updateRole] = useMutation(UPDATE_ROLE);
  const [updateSettings] = useMutation(UPDATE_SETTINGS);
  const [deleteLeaveType] = useMutation(DELETE_LEAVE_TYPE);
  const [deleteDept] = useMutation(DELETE_DEPT);
  
  if (loading && !data) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-surface-hover rounded-xl" />
            <div className="h-4 w-44 bg-surface-hover rounded-lg" />
          </div>
          <div className="h-11 w-32 bg-surface-hover rounded-xl" />
        </div>
        <div className="flex gap-2 border-b border-border pb-0">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 w-36 bg-surface-hover rounded-t-xl" />)}
        </div>
        <div className="glass rounded-3xl overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-6 p-4 border-b border-border">
              <div className="h-4 w-40 bg-surface-hover rounded-lg" />
              <div className="h-4 w-20 bg-surface-hover rounded-full" />
              <div className="h-4 w-32 bg-surface-hover rounded-lg" />
              <div className="h-4 w-36 bg-surface-hover rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Distinguish between a real access error and a query/network error
  if (!data?.me) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <p className="font-bold text-lg">Erreur de chargement</p>
          <p className="text-sm text-text-muted mt-1 max-w-sm">
            {error?.message || 'Impossible de charger la console. Vérifiez que le backend est démarré et que les migrations sont à jour.'}
          </p>
        </div>
        <button onClick={() => refetch()} className="btn-primary text-sm py-2 px-5">
          Réessayer
        </button>
      </div>
    );
  }

  if (data.me.role !== 'ADMIN') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
        <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <div>
          <p className="font-bold text-lg">Accès Refusé</p>
          <p className="text-sm text-text-muted mt-1">Cette page est réservée aux Administrateurs Système.</p>
        </div>
      </div>
    );
  }

  const { allEmployees = [], leaveTypes: allLeaveTypes = [], allAuditLogs = [], allDepartments = [], companySettings } = data;

  const handleManagerChange = async (employeeId: string, managerId: string) => {
    if (!managerId) return;
    if (!window.confirm("Êtes-vous sûr de vouloir réassigner le manager de cet employé ?")) return;
    try {
      const res = await assignManager({ variables: { employeeId, managerId } });
      if (res.data.assignManager.success) {
        toast.success("Manager réassigné avec succès.");
        refetch();
      } else {
        toast.error(res.data.assignManager.error);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir modifier le rôle de cet utilisateur ?")) return;
    try {
      const res = await updateRole({ variables: { userId, role } });
      if (res.data.updateUserRole.success) {
        toast.success("Rôle mis à jour.");
        refetch();
      } else {
        toast.error(res.data.updateUserRole.error);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const overlapThresholdPercent = parseInt(formData.get('overlap') as string, 10);
    try {
      const res = await updateSettings({ variables: { overlapThresholdPercent } });
      if (res.data.updateCompanySettings.success) {
        toast.success("Paramètres enregistrés avec succès.");
        refetch();
      } else {
        toast.error(res.data.updateCompanySettings.error);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteLeaveType = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce type de congé ?")) return;
    try {
      const res = await deleteLeaveType({ variables: { id } });
      if (res.data.deleteLeaveType.success) {
        toast.success("Type de congé supprimé.");
        refetch();
      } else {
        toast.error(res.data.deleteLeaveType.error);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDeleteDept = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce département ? Les employés qui y sont rattachés perdront leur département.")) return;
    try {
      const res = await deleteDept({ variables: { id } });
      if (res.data.deleteDepartment.success) {
        toast.success("Département supprimé.");
        refetch();
      } else {
        toast.error(res.data.deleteDepartment.error);
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const filteredEmployees = allEmployees.filter((emp: any) => 
    emp.firstName.toLowerCase().includes(empSearch.toLowerCase()) ||
    emp.lastName.toLowerCase().includes(empSearch.toLowerCase()) ||
    emp.matricule.toLowerCase().includes(empSearch.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Console d'Administration</h1>
        <p className="text-text-muted mt-1">Gérez les utilisateurs, les règles métier et consultez la piste d'audit certifiée.</p>
      </div>

      <div className="flex space-x-2 border-b border-border mb-6">
        <button
          onClick={() => setActiveTab('USERS')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
            activeTab === 'USERS' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main hover:border-border'
          }`}
        >
          <Users className="w-4 h-4" /> Utilisateurs & Rôles
        </button>
        <button
          onClick={() => setActiveTab('DEPARTMENTS')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
            activeTab === 'DEPARTMENTS' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main hover:border-border'
          }`}
        >
          <Building className="w-4 h-4" /> Départements
        </button>
        <button
          onClick={() => setActiveTab('RULES')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
            activeTab === 'RULES' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main hover:border-border'
          }`}
        >
          <Settings className="w-4 h-4" /> Règles Métier
        </button>
        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium transition-colors ${
            activeTab === 'AUDIT' ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text-main hover:border-border'
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> Piste d'Audit
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'USERS' && (
            <div className="glass rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-border flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">Annuaire des Utilisateurs</h2>
                  <p className="text-sm text-text-muted mt-1">L'anti-boucle hiérarchique est activée.</p>
                </div>
                <div className="flex gap-4">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input 
                      type="text" 
                      placeholder="Rechercher..." 
                      className="input-premium pl-9 py-1.5 text-sm w-64"
                      value={empSearch}
                      onChange={(e) => setEmpSearch(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => { setSelectedEmp(null); setEmpModalOpen(true); }}
                    className="btn-primary text-sm py-1.5 px-3 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-surface z-10">
                    <tr className="bg-surface-hover/50 text-text-muted text-sm uppercase tracking-wider">
                      <th className="p-4 font-medium">Employé</th>
                      <th className="p-4 font-medium">Rôle Actuel</th>
                      <th className="p-4 font-medium">Département</th>
                      <th className="p-4 font-medium">Manager Direct (N1)</th>
                      <th className="p-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredEmployees.map((emp: any) => (
                      <tr key={emp.id} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="p-4">
                          <div className="font-semibold flex items-center gap-2">
                            {emp.firstName} {emp.lastName}
                            {!emp.isActive && <span className="px-2 py-0.5 bg-red-500/10 text-red-500 rounded text-[10px] uppercase font-bold tracking-wider">Inactif</span>}
                          </div>
                          <div className="text-xs text-text-muted">{emp.matricule}</div>
                        </td>
                        <td className="p-4">
                          <select 
                            className="input-premium bg-background py-1.5 text-xs font-semibold text-primary border-primary/20"
                            value={emp.role}
                            onChange={(e) => handleRoleChange(emp.id, e.target.value)}
                          >
                            <option value="EMPLOYE">EMPLOYE</option>
                            <option value="MANAGER_N1">MANAGER_N1</option>
                            <option value="RH">RH</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="DIRECTEUR_GENERAL">DIRECTEUR_GENERAL</option>
                          </select>
                        </td>
                        <td className="p-4 text-sm">{emp.department?.nom || '-'}</td>
                        <td className="p-4">
                          <select 
                            className="input-premium bg-background py-1.5 text-sm"
                            value={emp.manager?.id || ''}
                            onChange={(e) => handleManagerChange(emp.id, e.target.value)}
                          >
                            <option value="">Sélectionner un manager...</option>
                            {allEmployees
                              .filter((m: any) => m.id !== emp.id)
                              .map((m: any) => (
                                <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
                              ))
                            }
                          </select>
                        </td>
                        <td className="p-4 text-right">
                          <button 
                            onClick={() => { setSelectedEmp(emp); setEmpModalOpen(true); }}
                            className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredEmployees.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-text-muted">Aucun employé trouvé.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'DEPARTMENTS' && (
            <div className="glass rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-border flex justify-between items-center">
                <h2 className="text-xl font-bold">Structure Organisationnelle</h2>
                <button 
                  onClick={() => { setSelectedDept(null); setDeptModalOpen(true); }}
                  className="btn-primary text-sm py-1.5 px-3 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter un Département
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-surface-hover/50 text-text-muted text-sm uppercase tracking-wider">
                      <th className="p-4 font-medium">Nom du Département</th>
                      <th className="p-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allDepartments.map((dept: any) => (
                      <tr key={dept.id} className="hover:bg-surface-hover/30 transition-colors">
                        <td className="p-4 font-semibold">{dept.nom}</td>
                        <td className="p-4 flex justify-end gap-2">
                          <button 
                            onClick={() => { setSelectedDept(dept); setDeptModalOpen(true); }}
                            className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteDept(dept.id)}
                            className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'RULES' && (
            <div className="space-y-6">
              <div className="glass rounded-3xl overflow-hidden p-6">
                <h2 className="text-xl font-bold mb-4">Paramètres Globaux</h2>
                <form onSubmit={handleUpdateSettings} className="flex items-end gap-4 max-w-lg">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-text-muted mb-1">Seuil d'alerte chevauchement par département (%)</label>
                    <input 
                      required 
                      type="number" 
                      name="overlap"
                      min="1" 
                      max="100" 
                      defaultValue={companySettings?.overlapThresholdPercent || 50} 
                      className="input-premium" 
                    />
                  </div>
                  <button type="submit" className="btn-primary py-2.5 px-6 shrink-0 flex items-center gap-2">
                    <Save className="w-4 h-4" /> Enregistrer
                  </button>
                </form>
              </div>

              <div className="glass rounded-3xl overflow-hidden">
                <div className="p-6 border-b border-border flex justify-between items-center">
                  <h2 className="text-xl font-bold">Types de Congé</h2>
                  <button 
                    onClick={() => { setSelectedLeave(null); setLeaveModalOpen(true); }}
                    className="btn-primary text-sm py-1.5 px-3 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter un Type
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-surface-hover/50 text-text-muted text-sm uppercase tracking-wider">
                        <th className="p-4 font-medium">Libellé</th>
                        <th className="p-4 font-medium text-center">Déduit du Solde</th>
                        <th className="p-4 font-medium text-center">Justificatif</th>
                        <th className="p-4 font-medium text-center">Motif Requis</th>
                        <th className="p-4 font-medium">Préavis (j)</th>
                        <th className="p-4 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {allLeaveTypes.map((lt: any) => (
                        <tr key={lt.id} className="hover:bg-surface-hover/30 transition-colors">
                          <td className="p-4 font-semibold">{lt.libelle}</td>
                          <td className="p-4 text-center">
                            {lt.deductibleSolde ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-red-500 mx-auto" />}
                          </td>
                          <td className="p-4 text-center">
                            {lt.requiresAttachment ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-red-500 mx-auto" />}
                          </td>
                          <td className="p-4 text-center">
                            {lt.requiresMotif ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-red-500 mx-auto" />}
                          </td>
                          <td className="p-4 text-sm text-text-muted">{lt.noticeDays ?? '-'}</td>
                          <td className="p-4 flex justify-end gap-2">
                            <button 
                              onClick={() => { setSelectedLeave(lt); setLeaveModalOpen(true); }}
                              className="p-2 text-text-muted hover:text-primary hover:bg-primary/10 rounded-xl transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteLeaveType(lt.id)}
                              className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'AUDIT' && (
            <div className="glass rounded-3xl overflow-hidden">
              <div className="p-6 border-b border-border flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold">Piste d'Audit Sécurisée</h2>
                  <p className="text-sm text-text-muted mt-1">Conformité 5 ans. Ces journaux sont inaltérables et ne peuvent être supprimés.</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-text-muted">Page {(auditOffset / auditLimit) + 1}</span>
                  <div className="flex gap-2">
                    <button 
                      disabled={auditOffset === 0}
                      onClick={() => setAuditOffset(Math.max(0, auditOffset - auditLimit))}
                      className="px-3 py-1.5 bg-surface border border-border rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-surface-hover"
                    >
                      Précédent
                    </button>
                    <button 
                      disabled={allAuditLogs.length < auditLimit}
                      onClick={() => setAuditOffset(auditOffset + auditLimit)}
                      className="px-3 py-1.5 bg-surface border border-border rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-surface-hover"
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[600px]">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-surface shadow-sm z-10">
                    <tr className="text-text-muted text-sm uppercase tracking-wider">
                      <th className="p-4 font-medium">Date & Heure</th>
                      <th className="p-4 font-medium">Action</th>
                      <th className="p-4 font-medium">Ancien Statut</th>
                      <th className="p-4 font-medium">Nouveau Statut</th>
                      <th className="p-4 font-medium">Utilisateur (ID)</th>
                      <th className="p-4 font-medium">Détails</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {allAuditLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-surface-hover/30 transition-colors text-sm">
                        <td className="p-4 text-text-muted font-mono">{new Date(log.timestamp).toLocaleString('fr-FR')}</td>
                        <td className="p-4 font-medium">
                          <span className="inline-flex px-2 py-0.5 rounded text-xs bg-gray-500/10 border border-gray-500/20">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-text-muted">{log.ancienStatut || '-'}</td>
                        <td className="p-4 font-semibold text-primary">{log.nouveauStatut || '-'}</td>
                        <td className="p-4">{log.userId ? `#${log.userId}` : 'Système'}</td>
                        <td className="p-4 text-text-muted">{log.details || '-'}</td>
                      </tr>
                    ))}
                    {allAuditLogs.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-text-muted">Aucun log d'audit trouvé.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <EmployeeManagementModal 
        isOpen={empModalOpen}
        onClose={() => setEmpModalOpen(false)}
        onSuccess={() => refetch()}
        employee={selectedEmp}
      />
      <LeaveTypeModal 
        isOpen={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        onSuccess={() => refetch()}
        leaveType={selectedLeave}
      />
      <DepartmentModal 
        isOpen={deptModalOpen}
        onClose={() => setDeptModalOpen(false)}
        onSuccess={() => refetch()}
        department={selectedDept}
      />
    </div>
  );
}
