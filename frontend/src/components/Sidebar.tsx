'use client';

import { useQuery, gql } from '@apollo/client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, FilePlus, CheckSquare, LogOut, Loader2, Leaf, UserCog, Calendar } from 'lucide-react';
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
    { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, roles: ['EMPLOYE', 'MANAGER_N1', 'RH', 'ADMIN', 'DG'] },
    { href: '/dashboard/manager', label: 'Espace Manager', icon: LayoutDashboard, roles: ['MANAGER_N1'] },
    { href: '/calendar', label: 'Calendrier', icon: Calendar, roles: ['MANAGER_N1', 'RH', 'ADMIN', 'DG', 'EMPLOYE'] },
    { href: '/leaves/new', label: 'Nouvelle Demande', icon: FilePlus, roles: ['EMPLOYE', 'MANAGER_N1', 'RH', 'ADMIN'] },
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
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Leaf className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-text-main tracking-tight">AgriEdge</h1>
        </div>
        <NotificationBell />
      </div>

      <div className="p-4 flex-1">
        <p className="px-3 text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Menu</p>
        <nav className="space-y-1">
          {links
            .filter((link) => link.roles.includes(user.role))
            .map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
              
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                    isActive 
                      ? 'bg-primary/10 text-primary font-medium' 
                      : 'text-text-muted hover:bg-surface-hover hover:text-text-main'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {link.label}
                </Link>
              );
            })}
        </nav>
      </div>

      <div className="p-4 border-t border-border">
        <div className="px-3 py-3 rounded-xl bg-surface-hover mb-4">
          <p className="text-sm font-medium text-text-main truncate">{user.firstName} {user.lastName}</p>
          <p className="text-xs text-text-muted capitalize">{user.role.toLowerCase().replace('_', ' ')}</p>
        </div>
        <button
          onClick={() => setPasswordModalOpen(true)}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-text-muted hover:text-text-main hover:bg-surface-hover rounded-xl transition-all duration-200"
        >
          <UserCog className="w-5 h-5" />
          Sécurité
        </button>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all duration-200 mt-1"
        >
          <LogOut className="w-5 h-5" />
          Déconnexion
        </button>
      </div>
      
      <ChangePasswordModal 
        isOpen={passwordModalOpen} 
        onClose={() => setPasswordModalOpen(false)} 
      />
    </aside>
  );
}
