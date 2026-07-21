'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2, UserPlus, Save } from 'lucide-react';
import { useMutation, gql } from '@apollo/client';

const CREATE_EMPLOYEE = gql`
  mutation CreateEmployee(
    $username: String!, $email: String!, $firstName: String!, $lastName: String!, 
    $matricule: String!, $role: String!, $password: String!, $departmentId: ID
  ) {
    createEmployee(
      username: $username, email: $email, firstName: $firstName, 
      lastName: $lastName, matricule: $matricule, role: $role, 
      password: $password, departmentId: $departmentId
    ) {
      success
      error
      employee { id }
    }
  }
`;

const UPDATE_EMPLOYEE = gql`
  mutation UpdateEmployee($employeeId: ID!, $role: String, $isActive: Boolean) {
    updateEmployee(employeeId: $employeeId, role: $role, isActive: $isActive) {
      success
      error
    }
  }
`;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employee?: any; // If null, create mode. If object, edit mode.
}

export function EmployeeManagementModal({ isOpen, onClose, onSuccess, employee }: Props) {
  const [createEmployee, { loading: creating }] = useMutation(CREATE_EMPLOYEE);
  const [updateEmployee, { loading: updating }] = useMutation(UPDATE_EMPLOYEE);

  const [formData, setFormData] = useState({
    username: employee?.username || '',
    email: employee?.email || '',
    firstName: employee?.firstName || '',
    lastName: employee?.lastName || '',
    matricule: employee?.matricule || '',
    role: employee?.role || 'EMPLOYE',
    password: '',
    isActive: employee?.isActive !== false
  });
  
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const isEdit = !!employee;

  const generatePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i <= 12; i++) {
      const randomNumber = Math.floor(Math.random() * chars.length);
      password += chars.substring(randomNumber, randomNumber + 1);
    }
    setFormData(prev => ({ ...prev, password }));
  };

  const copyToClipboard = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(formData.password);
    } else {
      // Fallback for non-HTTPS environments
      const el = document.createElement('textarea');
      el.value = formData.password;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      if (isEdit) {
        const res = await updateEmployee({
          variables: {
            employeeId: employee.id,
            role: formData.role,
            isActive: formData.isActive
          }
        });
        if (res.data.updateEmployee.success) {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.data.updateEmployee.error);
        }
      } else {
        const res = await createEmployee({
          variables: {
            username: formData.username,
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            matricule: formData.matricule,
            role: formData.role,
            password: formData.password
          }
        });
        if (res.data.createEmployee.success) {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.data.createEmployee.error);
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
              {isEdit ? <Save className="w-5 h-5 text-primary" /> : <UserPlus className="w-5 h-5 text-primary" />}
              {isEdit ? 'Modifier Employé' : 'Ajouter Employé'}
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
            {!isEdit && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Prénom</label>
                    <input required type="text" className="input-premium" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Nom</label>
                    <input required type="text" className="input-premium" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Username</label>
                    <input required type="text" className="input-premium" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1">Matricule</label>
                    <input required type="text" className="input-premium" value={formData.matricule} onChange={e => setFormData({...formData, matricule: e.target.value})} />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Email</label>
                  <input required type="email" className="input-premium" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1">Mot de Passe Provisoire</label>
                  <div className="flex gap-2">
                    <input 
                      required 
                      type="text" 
                      className="input-premium flex-1" 
                      value={formData.password} 
                      onChange={e => setFormData({...formData, password: e.target.value})} 
                      placeholder="Ex: P@ssw0rd2026!"
                    />
                    <button type="button" onClick={generatePassword} className="px-3 py-2 bg-surface-hover rounded-xl text-sm font-medium text-text-main hover:bg-surface-hover/80 transition-colors">
                      Générer
                    </button>
                    {formData.password && (
                      <button type="button" onClick={copyToClipboard} className="px-3 py-2 bg-primary/10 rounded-xl text-sm font-medium text-primary hover:bg-primary/20 transition-colors">
                        {copied ? 'Copié!' : 'Copier'}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-text-muted mt-1">Fournissez ce mot de passe à l'employé de manière sécurisée.</p>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Rôle</label>
              <select className="input-premium bg-background" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                <option value="EMPLOYE">Employé</option>
                <option value="MANAGER_N1">Manager N1</option>
                <option value="RH">Ressources Humaines</option>
                <option value="ADMIN">Administrateur</option>
                <option value="DG">Directeur Général</option>
              </select>
            </div>

            {isEdit && (
              <div className="flex items-center gap-3 mt-4">
                <input 
                  type="checkbox" 
                  id="isActive"
                  checked={formData.isActive}
                  onChange={e => setFormData({...formData, isActive: e.target.checked})}
                  className="w-4 h-4 rounded text-primary border-border bg-background focus:ring-primary focus:ring-offset-background"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-text-main">
                  Compte Actif
                </label>
              </div>
            )}

            <div className="pt-4 flex justify-end gap-3">
              <button type="button" onClick={onClose} className="px-4 py-2 text-text-muted hover:bg-surface-hover rounded-xl font-medium transition-colors">
                Annuler
              </button>
              <button type="submit" disabled={creating || updating} className="btn-primary py-2 px-6">
                {(creating || updating) ? <Loader2 className="w-5 h-5 animate-spin" /> : (isEdit ? 'Enregistrer' : 'Créer')}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
