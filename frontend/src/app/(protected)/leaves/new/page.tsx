'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, gql } from '@apollo/client';
import { Calendar, FileText, CheckCircle, AlertCircle, ArrowLeft, Upload, AlertTriangle, ShieldAlert, Loader2 } from 'lucide-react';
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

  const selectedType = typesData?.leaveTypes.find((t: any) => t.id === formData.leaveTypeId);

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

  if (loadingRequest) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-text-muted" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-main">
            {editId ? 'Modifier la Demande de Congé' : 'Nouvelle Demande de Congé'}
          </h1>
          <p className="text-text-muted mt-1">Remplissez le formulaire ci-dessous pour soumettre votre demande.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface border border-border rounded-xl p-6 shadow-sm space-y-6">
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">{errorMsg}</p>
              {errorMsg.includes('préavis') && (
                <p className="text-xs mt-1 text-red-300">
                  La case "Dérogation d'urgence" a été automatiquement cochée si votre demande est urgente.
                </p>
              )}
            </div>
          </div>
        )}

        {showNoticeWarning && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Délai de préavis ({selectedType.noticeDays} jours) non respecté</p>
              <p className="text-xs mt-0.5 text-amber-300">
                La date sélectionnée est inférieure au délai de préavis standard. Pour soumettre cette demande, cochez l'option "Dérogation d'urgence" ci-dessous.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-main mb-1.5">Type de congé</label>
            <select
              required
              className="input-field w-full"
              value={formData.leaveTypeId}
              onChange={(e) => setFormData({ ...formData, leaveTypeId: e.target.value })}
            >
              <option value="">Sélectionnez un type</option>
              {loadingTypes ? (
                <option disabled>Chargement...</option>
              ) : (
                typesData?.leaveTypes.map((type: any) => (
                  <option key={type.id} value={type.id}>
                    {type.libelle} {type.noticeDays > 0 ? `(Préavis ${type.noticeDays}j)` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-main mb-1.5">Date de début</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="date"
                  required
                  className="input-field w-full pl-9"
                  value={formData.dateDebut}
                  onChange={(e) => setFormData({ ...formData, dateDebut: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-main mb-1.5">Date de fin</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="date"
                  required
                  className="input-field w-full pl-9"
                  value={formData.dateFin}
                  onChange={(e) => setFormData({ ...formData, dateFin: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 bg-surface-hover/50 p-4 rounded-lg border border-border">
              <input
                type="checkbox"
                id="isHalfDay"
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 bg-background"
                checked={formData.isHalfDay}
                onChange={(e) => setFormData({ ...formData, isHalfDay: e.target.checked })}
              />
              <label htmlFor="isHalfDay" className="text-sm text-text-main cursor-pointer select-none">
                Demi-journée
              </label>
            </div>

            <div className="flex items-center gap-3 bg-surface-hover/50 p-4 rounded-lg border border-border">
              <input
                type="checkbox"
                id="isEmergency"
                className="w-4 h-4 rounded border-border text-amber-500 focus:ring-amber-500/20 bg-background"
                checked={formData.isEmergency}
                onChange={(e) => setFormData({ ...formData, isEmergency: e.target.checked })}
              />
              <label htmlFor="isEmergency" className="text-sm text-amber-400 font-medium cursor-pointer select-none flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Dérogation d'urgence
              </label>
            </div>
          </div>

          {selectedType?.requiresMotif && (
            <div>
              <label className="block text-sm font-medium text-text-main mb-1.5">Motif (Obligatoire)</label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 w-4 h-4 text-text-muted" />
                <textarea
                  required
                  className="input-field w-full pl-9 min-h-[100px] resize-y"
                  placeholder="Veuillez préciser le motif de votre congé..."
                  value={formData.motif}
                  onChange={(e) => setFormData({ ...formData, motif: e.target.value })}
                />
              </div>
            </div>
          )}

          {selectedType?.requiresAttachment && (
            <div>
              <label className="block text-sm font-medium text-text-main mb-1.5">
                Pièce jointe / Justificatif {editId ? '(Optionnel en modification)' : '(Obligatoire)'}
              </label>
              <div className="relative flex items-center border border-border rounded-xl p-3 bg-background">
                <Upload className="w-5 h-5 text-primary mr-3 shrink-0" />
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  required={!editId && selectedType?.requiresAttachment}
                  onChange={(e) => setFileAttachment(e.target.files?.[0] || null)}
                  className="text-sm text-text-muted file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
                />
              </div>
              <p className="text-xs text-text-muted mt-1">Formats acceptés: PDF, PNG, JPG (max 5 Mo).</p>
            </div>
          )}
        </div>

        <div className="pt-4 flex items-center justify-end border-t border-border">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="px-6 py-2.5 text-sm font-medium text-text-muted hover:text-text-main transition-colors mr-3"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary inline-flex items-center gap-2 px-6 py-2.5"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            {editId ? 'Enregistrer les modifications' : 'Soumettre la demande'}
          </button>
        </div>
      </form>
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
