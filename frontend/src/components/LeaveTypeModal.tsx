'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Save, FilePlus } from 'lucide-react';
import { useMutation, gql } from '@apollo/client';

const CREATE_LEAVE_TYPE = gql`
  mutation CreateLeaveType($libelle: String!, $description: String, $plafondJours: Decimal, $accumulationMensuelle: Decimal, $deductibleSolde: Boolean, $requiresAttachment: Boolean) {
    createLeaveType(libelle: $libelle, description: $description, plafondJours: $plafondJours, accumulationMensuelle: $accumulationMensuelle, deductibleSolde: $deductibleSolde, requiresAttachment: $requiresAttachment) {
      success
      error
    }
  }
`;

const UPDATE_LEAVE_TYPE = gql`
  mutation UpdateLeaveType($id: ID!, $libelle: String, $description: String, $plafondJours: Decimal, $accumulationMensuelle: Decimal, $deductibleSolde: Boolean, $requiresAttachment: Boolean) {
    updateLeaveType(id: $id, libelle: $libelle, description: $description, plafondJours: $plafondJours, accumulationMensuelle: $accumulationMensuelle, deductibleSolde: $deductibleSolde, requiresAttachment: $requiresAttachment) {
      success
      error
    }
  }
`;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  leaveType?: any;
}

export function LeaveTypeModal({ isOpen, onClose, onSuccess, leaveType }: Props) {
  const [createType, { loading: creating }] = useMutation(CREATE_LEAVE_TYPE);
  const [updateType, { loading: updating }] = useMutation(UPDATE_LEAVE_TYPE);

  const [formData, setFormData] = useState({
    libelle: leaveType?.libelle || '',
    description: leaveType?.description || '',
    plafondJours: leaveType?.plafondJours || '',
    accumulationMensuelle: leaveType?.accumulationMensuelle || '',
    deductibleSolde: leaveType?.deductibleSolde ?? true,
    requiresAttachment: leaveType?.requiresAttachment ?? false,
  });
  
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const isEdit = !!leaveType;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const variables = {
      libelle: formData.libelle,
      description: formData.description,
      plafondJours: formData.plafondJours ? formData.plafondJours : null,
      accumulationMensuelle: formData.accumulationMensuelle ? formData.accumulationMensuelle : null,
      deductibleSolde: formData.deductibleSolde,
      requiresAttachment: formData.requiresAttachment
    };

    try {
      if (isEdit) {
        const res = await updateType({ variables: { id: leaveType.id, ...variables } });
        if (res.data.updateLeaveType.success) {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.data.updateLeaveType.error);
        }
      } else {
        const res = await createType({ variables });
        if (res.data.createLeaveType.success) {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.data.createLeaveType.error);
        }
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative bg-surface border border-border shadow-2xl rounded-3xl p-6 w-full max-w-lg z-10"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              {isEdit ? <Save className="w-5 h-5 text-primary" /> : <FilePlus className="w-5 h-5 text-primary" />}
              {isEdit ? 'Modifier Type de Congé' : 'Ajouter Type de Congé'}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-surface-hover rounded-xl text-text-muted transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-red-500/10 text-red-500 rounded-xl text-sm border border-red-500/20">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Libellé</label>
              <input required type="text" className="input-premium" value={formData.libelle} onChange={e => setFormData({...formData, libelle: e.target.value})} />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Description</label>
              <textarea className="input-premium" rows={2} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Plafond (Jours)</label>
                <input type="number" step="0.5" className="input-premium" value={formData.plafondJours} onChange={e => setFormData({...formData, plafondJours: e.target.value})} placeholder="Ex: 30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Acquis / Mois</label>
                <input type="number" step="0.5" className="input-premium" value={formData.accumulationMensuelle} onChange={e => setFormData({...formData, accumulationMensuelle: e.target.value})} placeholder="Ex: 1.5" />
              </div>
            </div>

            <div className="flex gap-4 mt-4 bg-surface-hover/50 p-4 rounded-xl border border-border">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="deductible" checked={formData.deductibleSolde} onChange={e => setFormData({...formData, deductibleSolde: e.target.checked})} className="w-4 h-4 rounded text-primary focus:ring-primary" />
                <label htmlFor="deductible" className="text-sm font-medium">Déduit du solde</label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="attachment" checked={formData.requiresAttachment} onChange={e => setFormData({...formData, requiresAttachment: e.target.checked})} className="w-4 h-4 rounded text-primary focus:ring-primary" />
                <label htmlFor="attachment" className="text-sm font-medium">Justificatif Requis</label>
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-text-muted hover:bg-surface-hover rounded-xl font-medium transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={creating || updating} className="btn-primary py-2 px-6">
                {(creating || updating) ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enregistrer'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
