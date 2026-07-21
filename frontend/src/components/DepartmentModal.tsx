'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Save, Building } from 'lucide-react';
import { useMutation, gql } from '@apollo/client';

const CREATE_DEPT = gql`
  mutation CreateDept($nom: String!) {
    createDepartment(nom: $nom) {
      success
      error
    }
  }
`;

const UPDATE_DEPT = gql`
  mutation UpdateDept($id: ID!, $nom: String!) {
    updateDepartment(id: $id, nom: $nom) {
      success
      error
    }
  }
`;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  department?: any;
}

export function DepartmentModal({ isOpen, onClose, onSuccess, department }: Props) {
  const [createDept, { loading: creating }] = useMutation(CREATE_DEPT);
  const [updateDept, { loading: updating }] = useMutation(UPDATE_DEPT);

  const [nom, setNom] = useState(department?.nom || '');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const isEdit = !!department;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      if (isEdit) {
        const res = await updateDept({ variables: { id: department.id, nom } });
        if (res.data.updateDepartment.success) {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.data.updateDepartment.error);
        }
      } else {
        const res = await createDept({ variables: { nom } });
        if (res.data.createDepartment.success) {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.data.createDepartment.error);
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
          className="relative bg-surface border border-border shadow-2xl rounded-3xl p-6 w-full max-w-sm z-10"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Building className="w-5 h-5 text-primary" />
              {isEdit ? 'Modifier Département' : 'Ajouter Département'}
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
              <label className="block text-sm font-medium text-text-muted mb-1">Nom du Département</label>
              <input required type="text" className="input-premium" value={nom} onChange={e => setNom(e.target.value)} />
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
