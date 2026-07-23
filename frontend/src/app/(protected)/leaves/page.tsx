'use client';

import { useQuery, gql } from '@apollo/client';
import { Loader2, Plus, Calendar, Clock, FileText } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

const GET_MY_LEAVES = gql`
  query GetMyLeaves {
    myRequests {
      id
      dateDebut
      dateFin
      joursDecomptes
      motif
      statut
      pieceJointe
      createdAt
      leaveType {
        id
        libelle
      }
    }
  }
`;

export default function LeavesListPage() {
  const { data, loading, error } = useQuery(GET_MY_LEAVES, {
    fetchPolicy: 'cache-and-network',
  });

  const [filter, setFilter] = useState<string>('ALL');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="text-red-500 font-medium">Erreur lors du chargement des demandes.</div>;
  }

  const { myRequests = [] } = data;

  const filteredRequests = myRequests.filter((req: any) => {
    if (filter === 'VALIDE') return req.statut === 'VALIDE';
    if (filter === 'PENDING') return req.statut.startsWith('EN_ATTENTE');
    if (filter === 'REFUSE') return req.statut === 'REFUSE';
    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-text-main">Mes Demandes de Congé</h1>
          <p className="text-text-muted text-sm mt-0.5">Consultez l'historique et le suivi de toutes vos demandes.</p>
        </div>
        <Link href="/leaves/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nouvelle Demande
        </Link>
      </div>

      <div className="flex gap-2 border-b border-border">
        {['ALL', 'PENDING', 'VALIDE', 'REFUSE'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2.5 font-medium text-sm border-b-2 transition-colors ${
              filter === tab
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-text-muted hover:text-text-main'
            }`}
          >
            {tab === 'ALL' && 'Toutes'}
            {tab === 'PENDING' && 'En cours'}
            {tab === 'VALIDE' && 'Validées'}
            {tab === 'REFUSE' && 'Refusées'}
          </button>
        ))}
      </div>

      <div className="glass rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-hover/50 text-text-muted text-xs uppercase tracking-wider">
                <th className="p-4 font-semibold">Type</th>
                <th className="p-4 font-semibold">Période</th>
                <th className="p-4 font-semibold">Durée</th>
                <th className="p-4 font-semibold">Motif</th>
                <th className="p-4 font-semibold">Statut</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRequests.map((req: any) => (
                <tr key={req.id} className="hover:bg-surface-hover/30 transition-colors">
                  <td className="p-4 font-medium text-text-main">{req.leaveType.libelle}</td>
                  <td className="p-4 text-sm text-text-muted">
                    {new Date(req.dateDebut).toLocaleDateString('fr-FR')} au {new Date(req.dateFin).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="p-4 font-semibold text-primary">{req.joursDecomptes} j</td>
                  <td className="p-4 text-sm text-text-muted max-w-xs truncate">{req.motif || '-'}</td>
                  <td className="p-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                      {req.statut}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {['BROUILLON', 'REFUSE'].includes(req.statut) && (
                      <Link
                        href={`/leaves/new?edit=${req.id}`}
                        className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-medium transition-colors"
                      >
                        Modifier
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-muted">
                    Aucune demande trouvée.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
