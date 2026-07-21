'use client';

import { useQuery, useMutation, gql } from '@apollo/client';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, XCircle, FileText, Loader2, AlertTriangle, Archive, Trash2, Edit, CalendarCheck, TrendingUp, Hourglass, Palmtree, UserPlus, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { BalanceRing } from '@/components/BalanceRing';
import { useToast } from '@/components/Toast';

const DASHBOARD_QUERY = gql`
  query GetDashboard {
    me {
      firstName
      soldeConges
    }
    myRequests {
      id
      dateDebut
      dateFin
      joursDecomptes
      statut
      pieceJointe
      leaveType {
        libelle
      }
    }
    allEmployees {
      id
      firstName
      lastName
      matricule
      soldeConges
      role
      department {
        nom
      }
    }
  }
`;

const CANCEL_LEAVE = gql`
  mutation CancelLeave($leaveRequestId: ID!) {
    cancelLeaveRequest(leaveRequestId: $leaveRequestId) {
      success
      error
    }
  }
`;

const StatusBadge = ({ status }: { status: string }) => {
  const isPending = status.startsWith('EN_ATTENTE');

  const statusConfig: Record<string, { color: string; icon: any; label: string; dot?: string }> = {
    BROUILLON:              { color: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',   icon: FileText,      label: 'Brouillon' },
    EN_ATTENTE_N1:          { color: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', icon: Clock,         label: 'En attente N1',        dot: 'bg-amber-400' },
    EN_ATTENTE_RH:          { color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',   icon: Clock,         label: 'En attente RH',        dot: 'bg-blue-400' },
    VALIDE:                 { color: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', icon: CheckCircle, label: 'Approuvée' },
    REFUSE:                 { color: 'bg-red-500/10 text-red-400 border border-red-500/20',       icon: XCircle,       label: 'Rejetée' },
    EN_ATTENTE_ANNULATION:  { color: 'bg-orange-500/10 text-orange-400 border border-orange-500/20', icon: AlertTriangle, label: 'Annulation en attente', dot: 'bg-orange-400' },
    ANNULE:                 { color: 'bg-gray-500/10 text-gray-400 border border-gray-500/20',   icon: XCircle,       label: 'Annulée' },
    CLOTURE:                { color: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',   icon: Archive,       label: 'Clôturée' },
  };

  const config = statusConfig[status] || statusConfig.BROUILLON;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
      {config.dot ? (
        <span className="relative flex items-center justify-center w-2 h-2">
          <span className={`absolute inline-flex h-full w-full rounded-full ${config.dot} opacity-60 animate-ping`} />
          <span className={`relative inline-flex w-1.5 h-1.5 rounded-full ${config.dot}`} />
        </span>
      ) : (
        <Icon className="w-3.5 h-3.5" />
      )}
      {config.label}
    </span>
  );
};

import { RHBalanceModal } from '@/components/RHBalanceModal';
import { RHAnalytics } from '@/components/RHAnalytics';
import { DocumentViewerModal } from '@/components/DocumentViewerModal';
import { EmployeeManagementModal } from '@/components/EmployeeManagementModal';
import { HolidaysModal } from '@/components/HolidaysModal';

export default function DashboardPage() {
  const { data, loading, error, refetch } = useQuery(DASHBOARD_QUERY, { fetchPolicy: 'cache-and-network' });
  const toast = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [empToEdit, setEmpToEdit] = useState<any>(null);
  
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docUrl, setDocUrl] = useState('');
  const [docName, setDocName] = useState('');
  const [docLeaveId, setDocLeaveId] = useState('');
  

  
  // HR Employee Directory Filters
  const [empSearch, setEmpSearch] = useState('');
  const [empDeptFilter, setEmpDeptFilter] = useState('');
  
  const [cancelLeave, { loading: cancelLoading }] = useMutation(CANCEL_LEAVE, {
    onCompleted: (data) => {
      if (data.cancelLeaveRequest.success) {
        toast.success("Demande d'annulation soumise avec succès.");
        refetch();
      } else {
        toast.error(data.cancelLeaveRequest.error || "Erreur lors de l'annulation.");
      }
    }
  });

  const handleCancel = (id: string) => {
    if (confirm("Voulez-vous vraiment annuler cette demande ?")) {
      cancelLeave({ variables: { leaveRequestId: id } });
    }
  };

  const handleExport = async () => {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch('/api/export-leaves/', {
        headers: { 'Authorization': `JWT ${token}` }
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rapport_conges.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Export téléchargé avec succès.");
    } catch {
      toast.error("Erreur lors de l'exportation.");
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Header skeleton */}
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <div className="h-8 w-52 bg-surface-hover rounded-xl" />
            <div className="h-4 w-36 bg-surface-hover rounded-lg" />
          </div>
          <div className="h-11 w-40 bg-surface-hover rounded-xl" />
        </div>
        {/* Cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="glass p-6 rounded-3xl h-36" />
          ))}
        </div>
        {/* Table skeleton */}
        <div className="glass rounded-3xl overflow-hidden">
          <div className="p-6 border-b border-border">
            <div className="h-6 w-32 bg-surface-hover rounded-lg" />
          </div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4 p-4 border-b border-border">
              <div className="h-4 w-32 bg-surface-hover rounded-lg" />
              <div className="h-4 w-48 bg-surface-hover rounded-lg" />
              <div className="h-4 w-12 bg-surface-hover rounded-lg" />
              <div className="h-6 w-24 bg-surface-hover rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return <div className="text-red-500">Erreur lors du chargement des données.</div>;
  }

  const { me, myRequests } = data;

  const departments = Array.from(new Set(data.allEmployees.map((e: any) => e.department?.nom).filter(Boolean)));
  
  const filteredEmployees = data.allEmployees.filter((emp: any) => {
    const matchesSearch = `${emp.firstName} ${emp.lastName} ${emp.matricule}`.toLowerCase().includes(empSearch.toLowerCase());
    const matchesDept = empDeptFilter ? emp.department?.nom === empDeptFilter : true;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bonjour, {me.firstName}</h1>
          <p className="text-text-muted mt-1">Voici le résumé de vos congés.</p>
        </div>
        <Link href="/leaves/new" className="btn-primary">
          Nouvelle Demande
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ─── Balance Ring Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass p-6 rounded-3xl relative overflow-hidden col-span-1"
        >
          <div className="absolute right-0 top-0 w-40 h-40 bg-primary/5 rounded-bl-full pointer-events-none" />
          <p className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Solde de Congés</p>
          <div className="flex items-center gap-6">
            <BalanceRing current={me.soldeConges} max={30} />
            <div>
              <p className="text-text-muted text-sm">Disponibles</p>
              <p className="text-3xl font-bold tracking-tight text-text-main mt-0.5">
                {me.soldeConges} <span className="text-base font-medium text-text-muted">/ 30 j</span>
              </p>
              <p className="text-xs text-text-muted mt-2">
                {30 - me.soldeConges > 0 ? `${(30 - me.soldeConges).toFixed(1)} jours utilisés` : 'Solde plein'}
              </p>
            </div>
          </div>
        </motion.div>

        {/* ─── Pending Requests Card ─── */}
        {(() => {
          const pending = myRequests.filter((r: any) => r.statut.startsWith('EN_ATTENTE'));
          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.07 }}
              className="glass p-6 rounded-3xl relative overflow-hidden"
            >
              <div className="absolute right-0 top-0 w-32 h-32 bg-amber-500/5 rounded-bl-full pointer-events-none" />
              <p className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">En Attente</p>
              <div className="flex items-end gap-3">
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center shrink-0">
                  <Hourglass className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-4xl font-bold tracking-tight text-amber-400">{pending.length}</p>
                  <p className="text-xs text-text-muted mt-1">
                    {pending.length === 0 ? 'Aucune demande en cours' :
                     pending.length === 1 ? 'demande en cours de validation' : 'demandes en cours de validation'}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })()}

        {/* ─── Next Leave / Days Used Card ─── */}
        {(() => {
          const now = new Date();
          const upcoming = myRequests
            .filter((r: any) => r.statut === 'VALIDE' && new Date(r.dateDebut) >= now)
            .sort((a: any, b: any) => new Date(a.dateDebut).getTime() - new Date(b.dateDebut).getTime())[0];
          const usedThisYear = myRequests
            .filter((r: any) => r.statut === 'VALIDE' && new Date(r.dateDebut).getFullYear() === now.getFullYear())
            .reduce((acc: number, r: any) => acc + r.joursDecomptes, 0);

          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="glass p-6 rounded-3xl relative overflow-hidden"
            >
              <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/5 rounded-bl-full pointer-events-none" />
              {upcoming ? (
                <>
                  <p className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Prochain Congé</p>
                  <div className="flex items-end gap-3">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center shrink-0">
                      <CalendarCheck className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-base font-bold text-text-main">
                        {new Date(upcoming.dateDebut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {' → '}
                        {new Date(upcoming.dateFin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </p>
                      <p className="text-xs text-text-muted mt-1">{upcoming.joursDecomptes} j · {upcoming.leaveType.libelle}</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-text-muted uppercase tracking-wider mb-4">Cette Année</p>
                  <div className="flex items-end gap-3">
                    <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center shrink-0">
                      <TrendingUp className="w-6 h-6 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-4xl font-bold tracking-tight text-blue-400">{usedThisYear}<span className="text-lg font-medium text-text-muted ml-1">j</span></p>
                      <p className="text-xs text-text-muted mt-1">jours pris cette année</p>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          );
        })()}
      </div>

      <div className="glass rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold">Mes Demandes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-hover/50 text-text-muted text-sm uppercase tracking-wider">
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Période</th>
                <th className="p-4 font-medium">Jours</th>
                <th className="p-4 font-medium">Statut</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {myRequests.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col items-center justify-center py-16 px-8 text-center"
                    >
                      <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-5">
                        <Palmtree className="w-10 h-10 text-primary" strokeWidth={1.5} />
                      </div>
                      <h3 className="text-lg font-semibold text-text-main">Aucune demande de congé</h3>
                      <p className="text-sm text-text-muted mt-2 max-w-xs">
                        Vous n'avez pas encore déposé de demande. Profitez-en pour planifier votre prochain congé !
                      </p>
                      <Link
                        href="/leaves/new"
                        className="mt-6 btn-primary text-sm py-2.5 px-6 inline-flex items-center gap-2"
                      >
                        <CalendarCheck className="w-4 h-4" />
                        Déposer une demande
                      </Link>
                    </motion.div>
                  </td>
                </tr>
              ) : (
                myRequests.map((req: {
                  id: string;
                  leaveType: { libelle: string };
                  dateDebut: string;
                  dateFin: string;
                  joursDecomptes: number;
                  statut: string;
                  pieceJointe?: string;
                }) => {
                  const canCancel = ['EN_ATTENTE_N1', 'EN_ATTENTE_RH', 'VALIDE'].includes(req.statut);
                  const canEdit = ['BROUILLON', 'REFUSE'].includes(req.statut);
                  
                  return (
                  <tr key={req.id} className="hover:bg-surface-hover/30 transition-colors">
                    <td className="p-4">
                      <div className="font-medium">{req.leaveType.libelle}</div>
                      {req.pieceJointe && (
                        <button 
                          onClick={() => {
                            setDocUrl(req.pieceJointe);
                            setDocName(`Mon Certificat`);
                            setDocLeaveId(req.id);
                            setDocModalOpen(true);
                          }}
                          className="mt-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-md transition-colors"
                        >
                          Voir pièce jointe
                        </button>
                      )}
                    </td>
                    <td className="p-4 text-text-muted">
                      {new Date(req.dateDebut).toLocaleDateString('fr-FR')} - {new Date(req.dateFin).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="p-4 font-semibold">{req.joursDecomptes}</td>
                    <td className="p-4">
                      <StatusBadge status={req.statut} />
                    </td>
                    <td className="p-4 text-right flex justify-end gap-2">
                      {canEdit && (
                        <Link
                          href={`/leaves/new?edit=${req.id}`}
                          className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-sm font-medium transition-colors"
                        >
                          Modifier
                        </Link>
                      )}
                      {canCancel && (
                        <button 
                          onClick={() => handleCancel(req.id)}
                          disabled={cancelLoading}
                          className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors"
                        >
                          {cancelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Annuler'}
                        </button>
                      )}
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(me.role === 'RH' || me.role === 'ADMIN') && (
        <div className="mt-8 space-y-8">
          <RHAnalytics />
          
          <div className="glass rounded-3xl overflow-hidden">
            <div className="p-6 border-b border-border flex justify-between items-center">
              <h2 className="text-xl font-bold">Annuaire des employés (RH)</h2>
              <div className="flex gap-3">
                <button 
                  onClick={() => setHolidayModalOpen(true)}
                  className="btn-secondary flex items-center gap-2 py-2 px-4"
                >
                  <Calendar className="w-4 h-4" />
                  Jours Fériés
                </button>
                <button 
                  onClick={() => {
                    setEmpToEdit(null);
                    setEmpModalOpen(true);
                  }}
                  className="btn-secondary flex items-center gap-2 py-2 px-4"
                >
                  <UserPlus className="w-4 h-4" />
                  Ajouter Employé
                </button>
                <button 
                  onClick={handleExport}
                  className="btn-primary flex items-center gap-2 py-2 px-4"
                >
                  <FileText className="w-4 h-4" />
                  Exporter
                </button>
              </div>
            </div>
            
            <div className="p-4 border-b border-border bg-surface-hover/30 flex gap-4">
              <input 
                type="text" 
                placeholder="Rechercher par nom, matricule..." 
                className="input-premium flex-1"
                value={empSearch}
                onChange={(e) => setEmpSearch(e.target.value)}
              />
              <select 
                className="input-premium bg-background w-64"
                value={empDeptFilter}
                onChange={(e) => setEmpDeptFilter(e.target.value)}
              >
                <option value="">Tous les départements</option>
                {departments.map((dept: any) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-hover/50 text-text-muted text-sm uppercase tracking-wider">
                    <th className="p-4 font-medium">Matricule</th>
                    <th className="p-4 font-medium">Nom</th>
                    <th className="p-4 font-medium">Département</th>
                    <th className="p-4 font-medium">Rôle</th>
                    <th className="p-4 font-medium">Solde</th>
                    <th className="p-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredEmployees.map((emp: any) => (
                    <tr key={emp.id} className="hover:bg-surface-hover/30 transition-colors">
                      <td className="p-4 text-text-muted">{emp.matricule}</td>
                      <td className="p-4 font-medium">{emp.firstName} {emp.lastName}</td>
                      <td className="p-4 text-sm">{emp.department?.nom || '-'}</td>
                      <td className="p-4 text-sm">{emp.role}</td>
                      <td className="p-4 font-semibold text-primary">{emp.soldeConges}</td>
                      <td className="p-4 text-right flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            setEmpToEdit(emp);
                            setEmpModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-surface hover:bg-surface-hover border border-border rounded-lg text-sm font-medium transition-colors"
                          title="Modifier Employé"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setSelectedEmployee(emp)}
                          className="btn-secondary text-sm py-1.5 px-3"
                        >
                          Ajuster Solde
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-text-muted">Aucun employé trouvé.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <RHBalanceModal
        isOpen={!!selectedEmployee}
        onClose={() => setSelectedEmployee(null)}
        employee={selectedEmployee}
        onSuccess={() => {
          refetch();
        }}
      />

      <DocumentViewerModal
        isOpen={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        documentUrl={docUrl}
        documentName={docName}
        leaveRequestId={docLeaveId}
      />
      
      <EmployeeManagementModal
        isOpen={empModalOpen}
        onClose={() => setEmpModalOpen(false)}
        onSuccess={() => refetch()}
        employee={empToEdit}
      />

      <HolidaysModal 
        isOpen={holidayModalOpen}
        onClose={() => setHolidayModalOpen(false)}
      />
    </div>
  );
}
