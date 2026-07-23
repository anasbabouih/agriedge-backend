'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, gql } from '@apollo/client';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft, 
  Upload, 
  AlertTriangle, 
  ShieldAlert, 
  Loader2, 
  Sparkles, 
  Clock, 
  HeartPulse, 
  Umbrella, 
  RefreshCw, 
  Paperclip, 
  X,
  Info
} from 'lucide-react';
import Link from 'next/link';

const GET_LEAVE_TYPES = gql`
  query GetLeaveTypes {
    leaveTypes {
      id
      libelle
      requiresMotif
      requiresAttachment
      noticeDays
    }
  }
`;

const GET_LEAVE_REQUEST = gql`
  query GetLeaveRequest($id: ID!) {
    leaveRequest(id: $id) {
      id
      dateDebut
      dateFin
      motif
      statut
      pieceJointe
      leaveType {
        id
      }
    }
  }
`;

const SUBMIT_LEAVE = gql`
  mutation SubmitLeaveRequest(
    $leaveTypeId: ID!
    $dateDebut: Date!
    $dateFin: Date!
    $isHalfDay: Boolean
    $motif: String
    $isEmergency: Boolean
    $pieceJointe: Upload
  ) {
    submitLeaveRequest(
      leaveTypeId: $leaveTypeId
      dateDebut: $dateDebut
      dateFin: $dateFin
      isHalfDay: $isHalfDay
      motif: $motif
      isEmergency: $isEmergency
      pieceJointe: $pieceJointe
    ) {
      success
      error
      leaveRequest {
        id
        statut
      }
    }
  }
`;

const UPDATE_LEAVE = gql`
  mutation UpdateLeaveRequest(
    $id: ID!
    $leaveTypeId: ID
    $dateDebut: Date
    $dateFin: Date
    $isHalfDay: Boolean
    $motif: String
    $isEmergency: Boolean
    $pieceJointe: Upload
  ) {
    updateLeaveRequest(
      id: $id
      leaveTypeId: $leaveTypeId
      dateDebut: $dateDebut
      dateFin: $dateFin
      isHalfDay: $isHalfDay
      motif: $motif
      isEmergency: $isEmergency
      pieceJointe: $pieceJointe
    ) {
      success
      error
      leaveRequest {
        id
        statut
      }
    }
  }
`;

// Helper to choose icons for leave types
const getLeaveTypeIcon = (libelle: string) => {
  const name = libelle.toLowerCase();
  if (name.includes('payé') || name.includes('annuel')) return Umbrella;
  if (name.includes('maladie')) return HeartPulse;
  if (name.includes('récupération')) return RefreshCw;
  if (name.includes('exceptionnel')) return Sparkles;
  return Clock;
};

function LeaveRequestForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');

  const { data: typesData, loading: loadingTypes } = useQuery(GET_LEAVE_TYPES);
  const { data: requestData, loading: loadingRequest } = useQuery(GET_LEAVE_REQUEST, {
    variables: { id: editId },
    skip: !editId,
    fetchPolicy: 'network-only',
  });

  const [submitLeave, { loading: submittingNew }] = useMutation(SUBMIT_LEAVE);
  const [updateLeave, { loading: submittingUpdate }] = useMutation(UPDATE_LEAVE);
  const submitting = submittingNew || submittingUpdate;

  const [formData, setFormData] = useState({
    leaveTypeId: '',
    dateDebut: '',
    dateFin: '',
    isHalfDay: false,
    motif: '',
    isEmergency: false,
  });

  const [fileAttachment, setFileAttachment] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  // Populate form when editing an existing leave request
  useEffect(() => {
    if (requestData?.leaveRequest) {
      const req = requestData.leaveRequest;
      setFormData({
        leaveTypeId: req.leaveType?.id || '',
        dateDebut: req.dateDebut || '',
        dateFin: req.dateFin || '',
        isHalfDay: false,
        motif: req.motif || '',
        isEmergency: false,
      });
    }
  }, [requestData]);

  // Default to first leave type if available and none selected
  useEffect(() => {
    if (!formData.leaveTypeId && typesData?.leaveTypes?.length > 0 && !editId) {
      setFormData((prev) => ({ ...prev, leaveTypeId: typesData.leaveTypes[0].id }));
    }
  }, [typesData, editId, formData.leaveTypeId]);

  const selectedType = typesData?.leaveTypes.find((t: any) => t.id === formData.leaveTypeId);

  // Compute duration in days (excluding weekends simplified client-side check)
  const calculateDaysCount = () => {
    if (!formData.dateDebut || !formData.dateFin) return 0;
    const start = new Date(formData.dateDebut);
    const end = new Date(formData.dateFin);
    if (end < start) return 0;

    if (formData.isHalfDay) return 0.5;

    let count = 0;
    const cur = new Date(start);
    while (cur <= end) {
      const day = cur.getDay();
      if (day !== 0 && day !== 6) { // Exclude Sun (0) and Sat (6)
        count++;
      }
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  };

  const calculatedDays = calculateDaysCount();

  // Compute notice period discrepancy
  let showNoticeWarning = false;
  if (selectedType && selectedType.noticeDays > 0 && formData.dateDebut) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(formData.dateDebut);
    const diffDays = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
    if (diffDays < selectedType.noticeDays) {
      showNoticeWarning = true;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (selectedType?.requiresAttachment && !fileAttachment && !editId) {
      setErrorMsg('Une pièce jointe est obligatoire pour ce type de congé (ex: justificatif médical).');
      return;
    }

    try {
      if (editId) {
        const res = await updateLeave({
          variables: {
            id: editId,
            leaveTypeId: formData.leaveTypeId,
            dateDebut: formData.dateDebut,
            dateFin: formData.dateFin,
            isHalfDay: formData.isHalfDay,
            motif: formData.motif,
            isEmergency: formData.isEmergency,
            ...(fileAttachment ? { pieceJointe: fileAttachment } : {}),
          },
        });

        if (res.data.updateLeaveRequest.success) {
          router.push('/dashboard');
        } else {
          const err = res.data.updateLeaveRequest.error || 'Erreur lors de la modification.';
          setErrorMsg(err);
          if (err.includes('préavis')) {
            setFormData((prev) => ({ ...prev, isEmergency: true }));
          }
        }
      } else {
        const res = await submitLeave({
          variables: {
            leaveTypeId: formData.leaveTypeId,
            dateDebut: formData.dateDebut,
            dateFin: formData.dateFin,
            isHalfDay: formData.isHalfDay,
            motif: formData.motif,
            isEmergency: formData.isEmergency,
            ...(fileAttachment ? { pieceJointe: fileAttachment } : {}),
          },
        });

        if (res.data.submitLeaveRequest.success) {
          router.push('/dashboard');
        } else {
          const err = res.data.submitLeaveRequest.error || 'Erreur lors de la soumission.';
          setErrorMsg(err);
          if (err.includes('préavis')) {
            setFormData((prev) => ({ ...prev, isEmergency: true }));
          }
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue.');
    }
  };

  if (loadingRequest || loadingTypes) {
    return (
      <div className="flex flex-col justify-center items-center h-80 space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm text-text-muted">Chargement du formulaire de congé...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <Link 
            href="/dashboard" 
            className="p-3 bg-surface hover:bg-surface-hover border border-border rounded-2xl transition-all hover:scale-105 shadow-sm text-text-muted hover:text-text-main"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                {editId ? 'Édition' : 'Nouveau Formulaire'}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-text-main mt-1">
              {editId ? 'Modifier la Demande de Congé' : 'Nouvelle Demande de Congé'}
            </h1>
            <p className="text-text-muted text-sm mt-0.5">Saisissez les détails de votre absence pour validation RH & Manager.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Main Form (2 Cols) */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          <AnimatePresence>
            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                className="bg-red-500/10 border border-red-500/30 text-red-400 p-4 rounded-2xl flex items-start gap-3 shadow-lg backdrop-blur-md"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">{errorMsg}</p>
                  {errorMsg.includes('préavis') && (
                    <p className="text-xs mt-1 text-red-300">
                      Option "Dérogation d'urgence" activée automatiquement pour passer outre le préavis.
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {showNoticeWarning && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                className="bg-amber-500/10 border border-amber-500/30 text-amber-400 p-4 rounded-2xl flex items-start gap-3 shadow-lg backdrop-blur-md"
              >
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold">Délai de préavis ({selectedType.noticeDays} jours) non respecté</p>
                  <p className="text-xs mt-0.5 text-amber-300/90">
                    La date choisie est trop proche. Cochez l'option <strong>"Dérogation d'urgence"</strong> ci-dessous pour soumettre votre demande.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 1. Type selection cards */}
          <div className="glass rounded-3xl p-6 border border-border shadow-xl space-y-4">
            <label className="block text-sm font-bold text-text-main tracking-wide uppercase text-xs text-primary">
              1. Type de Congé
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {typesData?.leaveTypes.map((type: any) => {
                const IconComponent = getLeaveTypeIcon(type.libelle);
                const isSelected = formData.leaveTypeId === type.id;
                return (
                  <div
                    key={type.id}
                    onClick={() => setFormData({ ...formData, leaveTypeId: type.id })}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all duration-200 flex items-start gap-3 relative overflow-hidden ${
                      isSelected 
                        ? 'bg-primary/10 border-primary shadow-md shadow-primary/10 text-text-main' 
                        : 'bg-surface-hover/30 border-border hover:border-border-hover text-text-muted hover:text-text-main'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-0 right-0 w-3 h-3 bg-primary rounded-bl-lg" />
                    )}
                    <div className={`p-2.5 rounded-xl ${isSelected ? 'bg-primary text-white' : 'bg-surface-hover text-text-muted'}`}>
                      <IconComponent className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{type.libelle}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {type.noticeDays > 0 ? `Préavis ${type.noticeDays}j` : 'Sans préavis'}
                        {type.requiresAttachment && ' • Justificatif requise'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Dates selection */}
          <div className="glass rounded-3xl p-6 border border-border shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-bold tracking-wide uppercase text-xs text-primary">
                2. Période du Congé
              </label>
              {calculatedDays > 0 && (
                <span className="text-xs font-extrabold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {calculatedDays} jour{calculatedDays > 1 ? 's' : ''} décompté{calculatedDays > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Date de début</label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="date"
                    required
                    className="input-premium w-full pl-10"
                    value={formData.dateDebut}
                    onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">Date de fin</label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="date"
                    required
                    className="input-premium w-full pl-10"
                    value={formData.dateFin}
                    onChange={(e) => setFormData({ ...formData, dateFin: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div 
                onClick={() => setFormData({ ...formData, isHalfDay: !formData.isHalfDay })}
                className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                  formData.isHalfDay 
                    ? 'bg-primary/10 border-primary text-text-main' 
                    : 'bg-surface-hover/30 border-border text-text-muted'
                }`}
              >
                <input
                  type="checkbox"
                  id="isHalfDay"
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 bg-background pointer-events-none"
                  checked={formData.isHalfDay}
                  readOnly
                />
                <div>
                  <label htmlFor="isHalfDay" className="text-sm font-semibold text-text-main cursor-pointer select-none block">
                    Demi-journée
                  </label>
                  <p className="text-[11px] text-text-muted">Compte pour 0.5 jour d'absence</p>
                </div>
              </div>

              <div 
                onClick={() => setFormData({ ...formData, isEmergency: !formData.isEmergency })}
                className={`flex items-center gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                  formData.isEmergency 
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-400' 
                    : 'bg-surface-hover/30 border-border text-text-muted'
                }`}
              >
                <input
                  type="checkbox"
                  id="isEmergency"
                  className="w-4 h-4 rounded border-border text-amber-500 focus:ring-amber-500/20 bg-background pointer-events-none"
                  checked={formData.isEmergency}
                  readOnly
                />
                <div>
                  <label htmlFor="isEmergency" className="text-sm font-semibold text-amber-400 cursor-pointer select-none flex items-center gap-1">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    Dérogation d'urgence
                  </label>
                  <p className="text-[11px] text-text-muted">Pour demandes imprévues sans préavis</p>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Motif & Attachment */}
          <div className="glass rounded-3xl p-6 border border-border shadow-xl space-y-4">
            <label className="block text-sm font-bold tracking-wide uppercase text-xs text-primary">
              3. Justification & Pièces Jointes
            </label>

            {selectedType?.requiresMotif && (
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1.5">
                  Motif de l'absence <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-text-muted" />
                  <textarea
                    required
                    rows={3}
                    className="input-premium w-full pl-10 pt-3 min-h-[90px] resize-y text-sm"
                    placeholder="Précisez le motif (obligatoire pour ce type de congé)..."
                    value={formData.motif}
                    onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-text-muted mb-1.5">
                Pièce jointe / Justification médical 
                {selectedType?.requiresAttachment ? <span className="text-red-400"> (Obligatoire)</span> : ' (Optionnel)'}
              </label>

              {!fileAttachment ? (
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files?.[0]) setFileAttachment(e.dataTransfer.files[0]);
                  }}
                  className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all relative ${
                    isDragging ? 'border-primary bg-primary/10 scale-[0.99]' : 'border-border hover:border-primary/40 bg-surface-hover/20'
                  }`}
                >
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg"
                    required={!editId && selectedType?.requiresAttachment}
                    onChange={(e) => setFileAttachment(e.target.files?.[0] || null)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto mb-2">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-text-main">
                    Glissez-déposez votre fichier ici, ou <span className="text-primary underline">parcourez</span>
                  </p>
                  <p className="text-xs text-text-muted mt-1">Formats autorisés: PDF, PNG, JPG (max 5 Mo)</p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-surface border border-primary/30 shadow-md">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
                      <Paperclip className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-main truncate max-w-[200px] sm:max-w-[300px]">
                        {fileAttachment.name}
                      </p>
                      <p className="text-xs text-text-muted">
                        {(fileAttachment.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFileAttachment(null)}
                    className="p-2 text-text-muted hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-4 pt-2">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="btn-secondary px-6 py-3"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary inline-flex items-center gap-2 px-8 py-3 text-base shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all hover:scale-[1.02]"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
              {editId ? 'Enregistrer les modifications' : 'Soumettre la demande'}
            </button>
          </div>
        </form>

        {/* Live Summary Sidebar Card (1 Col) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass rounded-3xl p-6 border border-border shadow-xl space-y-6 sticky top-24">
            <div className="flex items-center gap-2 border-b border-border pb-4">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="font-bold text-lg text-text-main">Récapitulatif en direct</h3>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Type sélectionné</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <p className="font-bold text-text-main">{selectedType?.libelle || 'Non sélectionné'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 bg-surface-hover/40 rounded-2xl border border-border">
                <div>
                  <p className="text-[10px] text-text-muted uppercase">Début</p>
                  <p className="text-xs font-semibold mt-0.5">
                    {formData.dateDebut ? new Date(formData.dateDebut).toLocaleDateString('fr-FR') : '--/--/----'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-text-muted uppercase">Fin</p>
                  <p className="text-xs font-semibold mt-0.5">
                    {formData.dateFin ? new Date(formData.dateFin).toLocaleDateString('fr-FR') : '--/--/----'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                <span className="text-xs font-semibold text-text-muted">Total jours décomptés</span>
                <span className="text-xl font-black text-primary">{calculatedDays} j</span>
              </div>

              <div className="space-y-2 text-xs text-text-muted pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span>Justificatif joint:</span>
                  <span className={fileAttachment ? 'text-emerald-400 font-bold' : 'text-text-muted'}>
                    {fileAttachment ? 'Oui' : 'Non'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Dérogation d'urgence:</span>
                  <span className={formData.isEmergency ? 'text-amber-400 font-bold' : 'text-text-muted'}>
                    {formData.isEmergency ? 'Oui' : 'Non'}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-hover/50 border border-border text-xs text-text-muted space-y-2">
              <div className="flex items-center gap-1.5 font-semibold text-text-main">
                <Info className="w-4 h-4 text-primary shrink-0" />
                <span>Processus de validation</span>
              </div>
              <p className="leading-relaxed">
                Votre demande sera d'abord transmise à votre Manager N1, puis au service RH pour validation finale.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewLeaveRequest() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <LeaveRequestForm />
    </Suspense>
  );
}
