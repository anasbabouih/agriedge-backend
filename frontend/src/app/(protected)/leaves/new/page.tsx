'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, gql } from '@apollo/client';
import { Calendar, FileText, CheckCircle, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const GET_LEAVE_TYPES = gql`
  query GetLeaveTypes {
    leaveTypes {
      id
      libelle
      requiresMotif
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
  ) {
    submitLeaveRequest(
      leaveTypeId: $leaveTypeId
      dateDebut: $dateDebut
      dateFin: $dateFin
      isHalfDay: $isHalfDay
      motif: $motif
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

export default function NewLeaveRequest() {
  const router = useRouter();
  const { data, loading: loadingTypes } = useQuery(GET_LEAVE_TYPES);
  const [submitLeave, { loading: submitting }] = useMutation(SUBMIT_LEAVE);

  const [formData, setFormData] = useState({
    leaveTypeId: '',
    dateDebut: '',
    dateFin: '',
    isHalfDay: false,
    motif: '',
  });

  const [errorMsg, setErrorMsg] = useState('');

  const selectedType = data?.leaveTypes.find((t: any) => t.id === formData.leaveTypeId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      const res = await submitLeave({
        variables: {
          leaveTypeId: formData.leaveTypeId,
          dateDebut: formData.dateDebut,
          dateFin: formData.dateFin,
          isHalfDay: formData.isHalfDay,
          motif: formData.motif,
        },
      });

      if (res.data.submitLeaveRequest.success) {
        router.push('/dashboard');
      } else {
        setErrorMsg(res.data.submitLeaveRequest.error || 'Erreur lors de la soumission.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Une erreur est survenue.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-text-muted" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-main">Nouvelle Demande de Congé</h1>
          <p className="text-text-muted mt-1">Remplissez le formulaire ci-dessous pour soumettre votre demande.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-surface border border-border-color rounded-xl p-6 shadow-sm space-y-6">
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{errorMsg}</p>
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
                data?.leaveTypes.map((type: any) => (
                  <option key={type.id} value={type.id}>
                    {type.libelle}
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

          <div className="flex items-center gap-3 bg-surface-hover/50 p-4 rounded-lg border border-border-color">
            <input
              type="checkbox"
              id="isHalfDay"
              className="w-4 h-4 rounded border-border-color text-primary focus:ring-primary/20 bg-background"
              checked={formData.isHalfDay}
              onChange={(e) => setFormData({ ...formData, isHalfDay: e.target.checked })}
            />
            <label htmlFor="isHalfDay" className="text-sm text-text-main cursor-pointer select-none">
              Demi-journée
            </label>
          </div>

          {selectedType?.requiresMotif && (
            <div>
              <label className="block text-sm font-medium text-text-main mb-1.5">Motif</label>
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
        </div>

        <div className="pt-4 flex items-center justify-end border-t border-border-color">
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
            Soumettre la demande
          </button>
        </div>
      </form>
    </div>
  );
}
