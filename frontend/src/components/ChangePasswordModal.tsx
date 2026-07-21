'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, Key } from 'lucide-react';
import { useMutation, gql } from '@apollo/client';

const CHANGE_PASSWORD = gql`
  mutation ChangePassword($oldPassword: String!, $newPassword: String!) {
    changePassword(oldPassword: $oldPassword, newPassword: $newPassword) {
      success
      error
    }
  }
`;

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ isOpen, onClose }: Props) {
  const [changePassword, { loading }] = useMutation(CHANGE_PASSWORD);

  const [formData, setFormData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (formData.newPassword !== formData.confirmPassword) {
      setErrorMsg("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }

    try {
      const res = await changePassword({
        variables: {
          oldPassword: formData.oldPassword,
          newPassword: formData.newPassword
        }
      });
      
      if (res.data.changePassword.success) {
        setSuccessMsg("Mot de passe mis à jour avec succès.");
        setTimeout(() => {
          onClose();
          setFormData({ oldPassword: '', newPassword: '', confirmPassword: '' });
          setSuccessMsg('');
        }, 2000);
      } else {
        setErrorMsg(res.data.changePassword.error);
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
          className="relative bg-surface border border-border shadow-2xl rounded-3xl p-6 w-full max-w-md z-10"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Modifier Mot de Passe
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
          {successMsg && (
            <div className="mb-4 p-3 bg-green-500/10 text-green-500 rounded-xl text-sm border border-green-500/20">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Ancien mot de passe</label>
              <input 
                required 
                type="password" 
                className="input-premium" 
                value={formData.oldPassword} 
                onChange={e => setFormData({...formData, oldPassword: e.target.value})} 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Nouveau mot de passe</label>
              <input 
                required 
                type="password" 
                className="input-premium" 
                value={formData.newPassword} 
                onChange={e => setFormData({...formData, newPassword: e.target.value})} 
              />
              <p className="text-xs text-text-muted mt-1">
                Le mot de passe doit comporter au moins 8 caractères, dont des chiffres, et ne pas être trop commun.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Confirmer le nouveau mot de passe</label>
              <input 
                required 
                type="password" 
                className="input-premium" 
                value={formData.confirmPassword} 
                onChange={e => setFormData({...formData, confirmPassword: e.target.value})} 
              />
            </div>

            <div className="pt-4 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-text-muted hover:bg-surface-hover rounded-xl font-medium transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={loading || !!successMsg} className="btn-primary py-2 px-6">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Mettre à jour'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
