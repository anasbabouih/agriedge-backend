'use client';

import { useState } from 'react';
import { useQuery, gql } from '@apollo/client';
import { Loader2, Calendar as CalendarIcon, Filter, Info } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import frLocale from '@fullcalendar/core/locales/fr';

const GET_CALENDAR_LEAVES = gql`
  query GetCalendarLeaves {
    me {
      id
      role
    }
    allLeavesCalendar {
      id
      employee {
        id
        firstName
        lastName
        department {
          nom
        }
      }
      leaveType {
        libelle
      }
      dateDebut
      dateFin
      statut
      joursDecomptes
    }
  }
`;

export default function CalendarPage() {
  const { data, loading, error } = useQuery(GET_CALENDAR_LEAVES, {
    fetchPolicy: 'cache-and-network',
  });

  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="text-red-500 font-medium">Erreur lors du chargement du calendrier.</div>;
  }

  const { allLeavesCalendar = [] } = data;

  const filteredLeaves = allLeavesCalendar.filter((leave: any) => {
    if (statusFilter === 'VALIDE') return leave.statut === 'VALIDE';
    if (statusFilter === 'PENDING') return ['EN_ATTENTE_N1', 'EN_ATTENTE_RH', 'EN_ATTENTE_ANNULATION'].includes(leave.statut);
    return true;
  });

  const calendarEvents = filteredLeaves.map((leave: any) => {
    let backgroundColor = '#10b981'; // VALIDE (Green)
    if (leave.statut === 'EN_ATTENTE_N1') backgroundColor = '#f59e0b'; // Amber
    else if (leave.statut === 'EN_ATTENTE_RH') backgroundColor = '#3b82f6'; // Blue
    else if (leave.statut === 'EN_ATTENTE_ANNULATION') backgroundColor = '#f97316'; // Orange

    // Add 1 day to end date so FullCalendar displays inclusive range properly
    const endDate = new Date(new Date(leave.dateFin).getTime() + 86400000).toISOString().split('T')[0];

    return {
      id: leave.id,
      title: `${leave.employee.firstName} ${leave.employee.lastName} (${leave.leaveType.libelle})`,
      start: leave.dateDebut,
      end: endDate,
      backgroundColor,
      borderColor: 'transparent',
      extendedProps: {
        department: leave.employee.department?.nom || 'N/A',
        status: leave.statut,
        days: leave.joursDecomptes,
      },
    };
  });

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <CalendarIcon className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-text-main">Planning des Congés</h1>
              <p className="text-text-muted text-sm mt-0.5">Visualisez les absences prévues au sein de l'entreprise.</p>
            </div>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-3 bg-surface p-2 rounded-2xl border border-border">
          <Filter className="w-4 h-4 text-text-muted ml-2" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-transparent text-sm font-medium text-text-main focus:outline-none pr-3 cursor-pointer"
          >
            <option value="ALL">Toutes les demandes</option>
            <option value="VALIDE">Uniquement Validées</option>
            <option value="PENDING">En cours de validation</option>
          </select>
        </div>
      </div>

      {/* Legend */}
      <div className="glass p-4 rounded-2xl flex flex-wrap items-center gap-6 text-xs font-medium text-text-muted">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500" />
          <span>Congé Validé</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          <span>En attente RH</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span>En attente Manager (N1)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500" />
          <span>Annulation en attente</span>
        </div>
      </div>

      {/* Main Calendar View */}
      <div className="glass rounded-3xl p-6 shadow-sm">
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
              right: 'dayGridMonth,timeGridWeek',
            }}
            height="700px"
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              meridiem: false,
            }}
          />
        </div>
      </div>
    </div>
  );
}
