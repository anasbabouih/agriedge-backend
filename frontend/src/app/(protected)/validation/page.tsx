'use client';

import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, CheckCircle, XCircle, FileText, User, CheckSquare, Square } from 'lucide-react';
import { DocumentViewerModal } from '@/components/DocumentViewerModal';

const PENDING_APPROVALS_QUERY = gql`
  query GetPendingApprovals {
    pendingApprovals {
      id
      dateDebut
      dateFin
      joursDecomptes
      motif
      statut
      pieceJointe
      leaveType {
        libelle
      }
      employee {
        firstName
        lastName
        department {
          nom
        }
      }
    }
  }
`;

const PROCESS_APPROVAL_MUTATION = gql`
  mutation ProcessApproval($leaveRequestId: ID!, $decision: String!, $commentaire: String) {
    processApproval(leaveRequestId: $leaveRequestId, decision: $decision, commentaire: $commentaire) {
      success
      error
    }
  }
`;

const BULK_APPROVE_MUTATION = gql`
  mutation BulkApprove($leaveRequestIds: [ID]!) {
    bulkProcessApproval(leaveRequestIds: $leaveRequestIds) {
      successCount
      errorCount
      errors
    }
  }
`;

export default function ValidationPage() {
  const { data, loading, error, refetch } = useQuery(PENDING_APPROVALS_QUERY, {
    fetchPolicy: 'network-only'
  });
  
  const [processApproval, { loading: processing }] = useMutation(PROCESS_APPROVAL_MUTATION);
  const [bulkApprove, { loading: bulkProcessing }] = useMutation(BULK_APPROVE_MUTATION);

  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [decision, setDecision] = useState<'APPROUVE' | 'REFUSE' | null>(null);
  const [commentaire, setCommentaire] = useState('');
  
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docUrl, setDocUrl] = useState('');
  const [docName, setDocName] = useState('');
  const [docLeaveId, setDocLeaveId] = useState('');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="text-red-500">Erreur lors du chargement des demandes.</div>;
  }

  const requests = data.pendingApprovals;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === requests.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(requests.map((r: any) => r.id)));
    }
  };

  const handleOpenModal = (req: any, dec: 'APPROUVE' | 'REFUSE') => {
    setSelectedRequest(req);
    setDecision(dec);
    setCommentaire('');
  };

  const handleConfirm = async () => {
    if (!selectedRequest || !decision) return;
    
    if (decision === 'REFUSE' && !commentaire.trim()) {
      alert('Un commentaire est obligatoire pour un refus.');
      return;
    }

    try {
      const res = await processApproval({
        variables: {
          leaveRequestId: selectedRequest.id,
          decision,
          commentaire
        }
      });
      
      if (res.data.processApproval.success) {
        setSelectedRequest(null);
        refetch();
      } else {
        alert(res.data.processApproval.error);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Approuver ${selectedIds.size} demande(s) en lot ?`)) return;
    
    try {
      const res = await bulkApprove({
        variables: { leaveRequestIds: Array.from(selectedIds) }
      });
      const result = res.data.bulkProcessApproval;
      
      if (result.errorCount > 0) {
        alert(`${result.successCount} approuvée(s), ${result.errorCount} erreur(s):\n${result.errors?.join('\n')}`);
      }
      
      setSelectedIds(new Set());
      refetch();
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Validation des Congés</h1>
        <p className="text-text-muted mt-1">Gérez les demandes de votre équipe.</p>
      </div>

      <div className="glass rounded-3xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-hover/50 text-text-muted text-sm uppercase tracking-wider">
                <th className="p-4 font-medium w-12">
                  <button onClick={toggleSelectAll} className="text-text-muted hover:text-primary transition-colors">
                    {requests.length > 0 && selectedIds.size === requests.length ? (
                      <CheckSquare className="w-5 h-5 text-primary" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                </th>
                <th className="p-4 font-medium">Employé</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Période</th>
                <th className="p-4 font-medium">Jours</th>
                <th className="p-4 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-muted">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Aucune demande en attente.
                  </td>
                </tr>
              ) : (
                requests.map((req: any) => (
                  <tr key={req.id} className={`hover:bg-surface-hover/30 transition-colors ${selectedIds.has(req.id) ? 'bg-primary/5' : ''}`}>
                    <td className="p-4">
                      <button onClick={() => toggleSelect(req.id)} className="text-text-muted hover:text-primary transition-colors">
                        {selectedIds.has(req.id) ? (
                          <CheckSquare className="w-5 h-5 text-primary" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{req.employee.firstName} {req.employee.lastName}</p>
                          <p className="text-xs text-text-muted">{req.employee.department?.nom || 'Sans département'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{req.leaveType.libelle}</div>
                      {req.motif && (
                        <div className="text-xs text-text-muted mt-1 flex items-center gap-1">
                          <FileText className="w-3 h-3" /> {req.motif}
                        </div>
                      )}
                      {req.pieceJointe && (
                        <button 
                          onClick={() => {
                            setDocUrl(req.pieceJointe);
                            setDocName(`Certificat - ${req.employee.firstName} ${req.employee.lastName}`);
                            setDocLeaveId(req.id);
                            setDocModalOpen(true);
                          }}
                          className="mt-2 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 px-2 py-1 rounded-md transition-colors"
                        >
                          Voir la pièce jointe
                        </button>
                      )}
                    </td>
                    <td className="p-4 text-text-muted">
                      {new Date(req.dateDebut).toLocaleDateString('fr-FR')} - {new Date(req.dateFin).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="p-4 font-semibold text-primary">{req.joursDecomptes} j</td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenModal(req, 'APPROUVE')}
                          className="px-3 py-1.5 bg-green-500/10 text-green-600 hover:bg-green-500/20 rounded-lg text-sm font-medium transition-colors"
                        >
                          Approuver
                        </button>
                        <button
                          onClick={() => handleOpenModal(req, 'REFUSE')}
                          className="px-3 py-1.5 bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors"
                        >
                          Refuser
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="bg-surface glass border border-border rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-6">
              <span className="font-semibold text-sm">
                {selectedIds.size} demande{selectedIds.size > 1 ? 's' : ''} sélectionnée{selectedIds.size > 1 ? 's' : ''}
              </span>
              <button
                onClick={handleBulkApprove}
                disabled={bulkProcessing}
                className="px-4 py-2 bg-green-500 text-white rounded-xl font-medium flex items-center gap-2 hover:bg-green-600 transition-colors disabled:opacity-70"
              >
                {bulkProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Tout approuver
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-4 py-2 text-text-muted hover:bg-surface-hover rounded-xl font-medium transition-colors"
              >
                Annuler
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {selectedRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface glass border border-border p-6 rounded-3xl w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-2">
                {decision === 'APPROUVE' ? 'Confirmer l\'approbation' : 'Confirmer le refus'}
              </h3>
              <p className="text-text-muted text-sm mb-4">
                Vous êtes sur le point de {decision === 'APPROUVE' ? 'valider' : 'refuser'} la demande de {selectedRequest.employee.firstName}.
              </p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-text-muted mb-1.5">
                  Commentaire {decision === 'REFUSE' ? '(Obligatoire)' : '(Optionnel)'}
                </label>
                <textarea
                  className="input-premium bg-background min-h-[80px]"
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  placeholder={decision === 'REFUSE' ? 'Veuillez justifier le refus...' : 'Ajoutez une note...'}
                  required={decision === 'REFUSE'}
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 text-text-muted hover:bg-surface-hover rounded-xl font-medium transition-colors"
                  disabled={processing}
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={processing || (decision === 'REFUSE' && !commentaire.trim())}
                  className={`px-4 py-2 text-white rounded-xl font-medium flex items-center gap-2 transition-colors disabled:opacity-70 ${
                    decision === 'APPROUVE' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {processing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {decision === 'APPROUVE' ? 'Approuver' : 'Refuser'}
                </button>
              </div>
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
