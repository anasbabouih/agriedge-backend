import React from 'react';
import { useQuery, gql } from '@apollo/client';
import { Loader2, TrendingUp, BarChart2, PieChart as PieChartIcon, AlertTriangle, User } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const GET_RH_ANALYTICS = gql`
  query GetRHAnalytics {
    rhAnalytics {
      totalLeavesThisMonth
      averageBalances {
        departmentName
        averageBalance
      }
      statusCounts {
        status
        count
      }
      dayCounts {
        day
        count
      }
      burnoutRiskEmployees {
        employeeId
        firstName
        lastName
        departmentName
        soldeConges
        daysSinceLastLeave
      }
    }
  }
`;

const STATUS_COLORS: Record<string, string> = {
  BROUILLON: '#9ca3af',
  EN_ATTENTE_N1: '#f59e0b',
  EN_ATTENTE_RH: '#3b82f6',
  VALIDE: '#10b981',
  REFUSE: '#ef4444',
  EN_ATTENTE_ANNULATION: '#f97316',
  ANNULE: '#6b7280',
  CLOTURE: '#06b6d4',
};

// Reorder days logically
const DAY_ORDER = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export function RHAnalytics() {
  const { data, loading, error } = useQuery(GET_RH_ANALYTICS, { fetchPolicy: 'cache-and-network' });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 glass rounded-3xl">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.rhAnalytics) {
    return <div className="text-red-500 p-4">Erreur lors du chargement des statistiques.</div>;
  }

  const { averageBalances, statusCounts, dayCounts, totalLeavesThisMonth, burnoutRiskEmployees } = data.rhAnalytics;

  // Sort dayCounts by DAY_ORDER
  const sortedDayCounts = [...dayCounts].sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));

  return (
    <div className="space-y-6">
      <div className="glass p-6 rounded-3xl border-b border-border">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-6 h-6 text-primary" />
          <h2 className="text-xl font-bold">Tableau de Bord Analytique RH</h2>
        </div>
        <p className="text-text-muted mt-1 text-sm">Aperçu global en temps réel</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* KPI Card */}
        <div className="glass p-6 rounded-3xl flex flex-col justify-center">
          <p className="text-text-muted font-medium mb-2">Demandes ce mois-ci</p>
          <div className="text-5xl font-bold text-primary">{totalLeavesThisMonth}</div>
        </div>

        {/* Status Distribution (Pie Chart) */}
        <div className="glass p-6 rounded-3xl md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-5 h-5 text-text-muted" />
            <h3 className="font-semibold text-text-main">Répartition par Statut</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusCounts}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="count"
                  nameKey="status"
                  label={({ status, percent }) => `${status} ${(percent * 100).toFixed(0)}%`}
                >
                  {statusCounts.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status] || '#cbd5e1'} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.9)', borderColor: '#2e2e2e', borderRadius: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Average Balance per Department */}
        <div className="glass p-6 rounded-3xl md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-5 h-5 text-text-muted" />
            <h3 className="font-semibold text-text-main">Solde Moyen par Département</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={averageBalances} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" vertical={false} />
                <XAxis dataKey="departmentName" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.9)', borderColor: '#2e2e2e', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="averageBalance" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} name="Solde Moyen (jours)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Days of week */}
        <div className="glass p-6 rounded-3xl">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-text-muted" />
            <h3 className="font-semibold text-text-main">Jours de départ</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sortedDayCounts} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2e2e2e" vertical={false} />
                <XAxis dataKey="day" stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'rgba(20, 20, 20, 0.9)', borderColor: '#2e2e2e', borderRadius: '12px' }}
                />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} name="Demandes" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Burnout Risk Alert */}
        {burnoutRiskEmployees && burnoutRiskEmployees.length > 0 && (
          <div className="glass p-6 rounded-3xl md:col-span-3 border border-orange-500/30">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <h3 className="font-semibold text-orange-500">Risque de Burnout ({burnoutRiskEmployees.length} employé{burnoutRiskEmployees.length > 1 ? 's' : ''})</h3>
            </div>
            <p className="text-xs text-text-muted mb-4">Employés avec un solde &gt; 20 jours ou sans congé depuis plus de 6 mois.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {burnoutRiskEmployees.map((emp: any) => (
                <div key={emp.employeeId} className="flex items-center gap-3 p-3 bg-orange-500/5 rounded-xl border border-orange-500/10">
                  <div className="w-9 h-9 bg-orange-500/10 rounded-full flex items-center justify-center shrink-0">
                    <User className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{emp.firstName} {emp.lastName}</p>
                    <p className="text-[11px] text-text-muted">{emp.departmentName}</p>
                    <div className="flex gap-3 mt-0.5">
                      <span className="text-[11px] font-semibold text-orange-500">{emp.soldeConges}j restants</span>
                      <span className="text-[11px] text-text-muted">
                        {emp.daysSinceLastLeave >= 999 ? 'Jamais de congé' : `${emp.daysSinceLastLeave}j sans congé`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
