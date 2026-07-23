'use client';

import { useQuery, gql } from '@apollo/client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, FilePlus, CheckSquare, LogOut, Loader2, Leaf, UserCog, Calendar, Home, LogIn } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { ChangePasswordModal } from './ChangePasswordModal';
import { useState } from 'react';

const GET_ME = gql`
  query GetMe {
    me {
      id
      firstName
      lastName
      role
    }
  }
`;

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  
  const { data, loading, error } = useQuery(GET_ME, {
    fetchPolicy: 'network-only', // Ensure we always get fresh user data on load
  });

  if (loading) return (
    <div className="w-64 h-full border-r border-border glass flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  if (error || !data?.me) {
    // If not authenticated, redirect to login
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      router.push('/login');
    }
    return null;
  }

  const user = data.me;

  const links = [
    { href: '/dashboard', label: 'Accueil / Tableau de bord', icon: Home, roles: ['EMPLOYE', 'MANAGER_N1', 'RH', 'ADMIN', 'DG'] },
    { href: '/dashboard/manager', label: 'Espace Manager', icon: LayoutDashboard, roles: ['MANAGER_N1', 'ADMIN'] },
    { href: '/calendar', label: 'Calendrier', icon: Calendar, roles: ['MANAGER_N1', 'RH', 'ADMIN', 'DG', 'EMPLOYE'] },
    { href: '/leaves/new', label: 'Nouvelle Demande', icon: FilePlus, roles: ['EMPLOYE', 'MANAGER_N1', 'RH', 'ADMIN', 'DG'] },
    { href: '/validation', label: 'Validation', icon: CheckSquare, roles: ['MANAGER_N1', 'RH', 'ADMIN', 'DG'] },
    { href: '/dashboard/admin', label: 'Administration', icon: UserCog, roles: ['ADMIN'] },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  return (
    <aside className="w-64 h-full border-r border-border glass flex flex-col">
      <div className="p-6 flex items-center justify-between border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-primary/10 group-hover:bg-primary/20 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105">
            <Leaf className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-main tracking-tight group-hover:text-primary transition-colors">AgriEdge</h1>
            <p className="text-[10px] text-text-muted font-medium">Gestion des Congés</p>
          </div>
        </Link>
        <NotificationBell />
      </div>

      <div className="p-4 flex-1 overflow-y-auto">
        <p className="px-3 text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Navigation principal</p>
        <nav className="space-y-1">
          {links
            .filter((link) => link.roles.includes(user.role))
            .map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(`${link.href}/`));
              
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-primary/10 text-primary font-semibold shadow-sm' 
                      : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="text-sm">{link.label}</span>
                </Link>
              );
            })}
        </nav>
      </div>

      <div className="p-4 border-t border-border space-y-2">
        <div className="px-3 py-3 rounded-xl bg-surface-hover/70 border border-border">
          <p className="text-sm font-semibold text-text-main truncate">{user.firstName} {user.lastName}</p>
          <span className="inline-block mt-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
            {user.role?.replace('_', ' ')}
          </span>
        </div>

        <button
          onClick={() => setPasswordModalOpen(true)}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-xs font-medium text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl transition-all duration-200"
        >
          <UserCog className="w-4 h-4" />
          Sécurité & Mot de passe
        </button>

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-all duration-200"
        >
          <LogIn className="w-4 h-4 rotate-180" />
          Aller à la page de Connexion
        </button>
      </div>
      
      <ChangePasswordModal 
        isOpen={passwordModalOpen} 
        onClose={() => setPasswordModalOpen(false)} 
      />
    </aside>
  );
}
