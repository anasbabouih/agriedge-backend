'use client';

import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Users, AlertTriangle, FileText, CheckCircle, XCircle, Clock } from 'lucide-react';
import { DocumentViewerModal } from '@/components/DocumentViewerModal';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';

const MANAGER_DASHBOARD_QUERY = gql`
  query GetManagerDashboard {
    me { role }
    managerDashboardStats {
      pendingN1Count
      absentTodayCount
      staleRequestsCount
    }
    pendingApprovals {
      id
      employee {
        firstName
        lastName
      }
      leaveType {
        libelle
      }
      dateDebut
      dateFin
      joursDecomptes
      motif
      statut
      pieceJointe
    }
    allLeavesCalendar {
      id
      employee {
        firstName
        lastName
      }
      leaveType {
        libelle
      }
      dateDebut
      dateFin
      statut
    }
  }
`;

const PROCESS_APPROVAL = gql`
  mutation ProcessApproval($leaveRequestId: ID!, $decision: String!, $commentaire: String) {
    processApproval(leaveRequestId: $leaveRequestId, decision: $decision, commentaire: $commentaire) {
      success
      error
    }
  }
`;

export default function ManagerDashboardPage() {
  const { data, loading, refetch } = useQuery(MANAGER_DASHBOARD_QUERY, { fetchPolicy: 'cache-and-network' });
  const [processApproval, { loading: processing }] = useMutation(PROCESS_APPROVAL, {
    onCompleted: (data) => {
      if (data.processApproval.success) {
        setRejectModalOpen(false);
        setRejectReason('');
        setSelectedRequest(null);
        refetch();
      } else {
        alert(data.processApproval.error);
      }
    }
  });

  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docUrl, setDocUrl] = useState('');
  const [docName, setDocName] = useState('');
  const [docLeaveId, setDocLeaveId] = useState('');

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data || !['MANAGER_N1', 'ADMIN'].includes(data.me.role)) {
    return <div className="text-red-500 font-bold p-8 text-center text-xl">Accès Réservé aux Managers.</div>;
  }

  const { managerDashboardStats, pendingApprovals, allLeavesCalendar } = data;

  const handleApprove = (id: string) => {
    if (confirm("Confirmez-vous la validation de cette demande ?")) {
      processApproval({ variables: { leaveRequestId: id, decision: 'APPROUVE' } });
    }
  };

  const handleReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      alert("Le commentaire de refus est obligatoire.");
      return;
    }
    if (selectedRequest) {
      processApproval({ variables: { leaveRequestId: selectedRequest, decision: 'REFUSE', commentaire: rejectReason } });
    }
  };

  const calendarEvents = allLeavesCalendar.map((leave: any) => ({
    id: leave.id,
    title: `${leave.employee.firstName} ${leave.employee.lastName} - ${leave.leaveType.libelle}`,
    start: leave.dateDebut,
    end: new Date(new Date(leave.dateFin).getTime() + 86400000).toISOString().split('T')[0],
    backgroundColor: leave.statut === 'VALIDE' ? '#10b981' : (leave.statut === 'EN_ATTENTE_RH' ? '#3b82f6' : '#f59e0b'),
    borderColor: 'transparent'
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Espace Manager</h1>
        <p className="text-text-muted mt-1">Pilotez les présences et validez les demandes de votre équipe.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass p-6 rounded-3xl flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center">
            <Clock className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <p className="text-sm text-text-muted font-medium">À valider (N1)</p>
            <p className="text-2xl font-bold">{managerDashboardStats.pendingN1Count}</p>
          </div>
        </div>
        <div className="glass p-6 rounded-3xl flex items-center gap-4">
          <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center">
            <Users className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <p className="text-sm text-text-muted font-medium">Équipe absente (Aujourd'hui)</p>
            <p className="text-2xl font-bold">{managerDashboardStats.absentTodayCount}</p>
          </div>
        </div>
        <div className="glass p-6 rounded-3xl flex items-center gap-4">
          <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <p className="text-sm text-text-muted font-medium">Demandes inactives {'>'} 3 jours</p>
            <p className="text-2xl font-bold text-orange-500">{managerDashboardStats.staleRequestsCount}</p>
          </div>
        </div>
      </div>

      <div className="glass rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold">File d'Approbation (Équipe)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-hover/50 text-text-muted text-sm uppercase tracking-wider">
                <th className="p-4 font-medium">Collaborateur</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Période</th>
                <th className="p-4 font-medium">Alertes</th>
                <th className="p-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pendingApprovals.map((req: any) => (
                <tr key={req.id} className="hover:bg-surface-hover/30 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold">{req.employee.firstName} {req.employee.lastName}</div>
                    {req.pieceJointe && (
                      <button 
                        onClick={() => {
                          setDocUrl(req.pieceJointe);
                          setDocName(`Certificat - ${req.employee.firstName}`);
                          setDocLeaveId(req.id);
                          setDocModalOpen(true);
                        }}
                        className="mt-1 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-md transition-colors inline-flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" /> Voir justificatif (Sécurisé)
                      </button>
                    )}
                  </td>
                  <td className="p-4 text-sm">
                    <div className="font-medium">{req.leaveType.libelle}</div>
                    <div className="text-xs text-text-muted">{req.joursDecomptes} jour(s)</div>
                  </td>
                  <td className="p-4 text-sm text-text-muted">
                    {new Date(req.dateDebut).toLocaleDateString('fr-FR')} au {new Date(req.dateFin).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="p-4">
                    {/* Overlap alerts placeholder */}
                  </td>
                  <td className="p-4 text-right space-x-2">
                    <button 
                      onClick={() => handleApprove(req.id)}
                      disabled={processing}
                      className="px-3 py-1.5 bg-green-500/10 text-green-500 hover:bg-green-500/20 rounded-lg text-sm font-medium transition-colors"
                    >
                      Approuver
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedRequest(req.id);
                        setRejectModalOpen(true);
                      }}
                      disabled={processing}
                      className="px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors"
                    >
                      Refuser
                    </button>
                  </td>
                </tr>
              ))}
              {pendingApprovals.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-text-muted">
                    Aucune demande en attente de votre validation.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass rounded-3xl p-6">
        <h2 className="text-xl font-bold mb-6">Planning d'Équipe</h2>
        <div className="calendar-container">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locales={[frLocale]}
            locale="fr"
            events={calendarEvents}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek'
            }}
            height="600px"
          />
        </div>
      </div>

      <AnimatePresence>
        {rejectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setRejectModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-surface border border-border shadow-2xl rounded-3xl p-6">
              <h2 className="text-xl font-bold mb-4">Refuser la demande</h2>
              <p className="text-sm text-text-muted mb-4">La saisie d'un motif est obligatoire pour justifier le refus auprès du collaborateur et des RH.</p>
              <form onSubmit={handleReject}>
                <textarea
                  className="input-premium w-full h-32 mb-4"
                  placeholder="Saisissez le motif du refus..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  required
                />
                <div className="flex justify-end gap-3">
                  <button type="button" onClick={() => setRejectModalOpen(false)} className="btn-secondary">Annuler</button>
                  <button type="submit" disabled={processing} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors">
                    Confirmer le refus
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DocumentViewerModal
        isOpen={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        documentUrl={docUrl}
        documentName={docName}
        leaveRequestId={docLeaveId}
      />
    </div>
  );
}
