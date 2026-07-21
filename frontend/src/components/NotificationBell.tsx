'use client';

import { useQuery, useMutation, gql } from '@apollo/client';
import { Bell, Check, Send, CheckCircle, Clock, Loader2, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';

const timeAgo = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return "à l'instant";
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `il y a ${diffInMinutes} min`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `il y a ${diffInHours}h`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return "hier";
  if (diffInDays < 7) return `il y a ${diffInDays} j`;
  
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
};

const getIconForType = (type: string) => {
  switch (type) {
    case 'SOUMISSION':
      return { icon: Send, color: 'text-blue-500', bg: 'bg-blue-500/10' };
    case 'DECISION':
      return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' };
    case 'RAPPEL':
      return { icon: Bell, color: 'text-amber-500', bg: 'bg-amber-500/10' };
    default:
      return { icon: Bell, color: 'text-primary', bg: 'bg-primary/10' };
  }
};

const NOTIFICATIONS_QUERY = gql`
  query GetNotifications {
    pendingValidationsCount
    myNotifications {
      id
      title
      message
      isRead
      type
      createdAt
    }
  }
`;

const MARK_READ = gql`
  mutation MarkRead($id: ID!) {
    markNotificationAsRead(id: $id) {
      success
    }
  }
`;

const MARK_ALL_READ = gql`
  mutation MarkAllRead {
    markAllNotificationsRead {
      success
    }
  }
`;

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { data, loading, refetch } = useQuery(NOTIFICATIONS_QUERY, {
    pollInterval: 10000,
    fetchPolicy: 'network-only',
  });

  const [markRead] = useMutation(MARK_READ);
  const [markAllRead, { loading: markingAll }] = useMutation(MARK_ALL_READ);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notifications = data?.myNotifications || [];
  const unreadCount = notifications.filter((n: any) => !n.isRead).length;

  const handleMarkRead = async (id: string) => {
    await markRead({ variables: { id } });
    refetch();
  };

  const handleMarkAllRead = async () => {
    await markAllRead();
    refetch();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        className="relative p-2 rounded-full hover:bg-surface-hover transition-colors text-text-muted hover:text-primary"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-background">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-surface border border-border rounded-2xl shadow-xl overflow-hidden z-50" role="menu">
          <div className="p-4 border-b border-border flex justify-between items-center gap-2">
            <h3 className="font-semibold shrink-0">Notifications</h3>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {unreadCount > 0 && (
                <button 
                  onClick={handleMarkAllRead} 
                  disabled={markingAll}
                  className="text-[10px] flex items-center gap-1 text-primary hover:bg-primary/10 px-2 py-1 rounded-md transition-colors"
                  title="Tout marquer comme lu"
                >
                  {markingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCheck className="w-3 h-3" />}
                  Tout marquer lu
                </button>
              )}
              {data?.pendingValidationsCount > 0 && (
                <Link href="/validation" className="text-xs text-primary hover:underline bg-primary/10 px-2 py-1 rounded-md" onClick={() => setIsOpen(false)}>
                  {data.pendingValidationsCount} à valider
                </Link>
              )}
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && !data ? (
              <div className="p-4 flex justify-center items-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-sm text-text-muted">Aucune notification</div>
            ) : (
              notifications.map((notif: any) => {
                const { icon: Icon, color, bg } = getIconForType(notif.type);
                return (
                <div key={notif.id} role="menuitem" className={`p-4 border-b border-border/50 hover:bg-surface-hover/50 transition-colors ${!notif.isRead ? 'bg-primary/5' : ''}`}>
                  <div className="flex gap-3">
                    <div className={`mt-1 shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${bg}`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-sm font-semibold">{notif.title}</h4>
                        {!notif.isRead && (
                          <button 
                            onClick={() => handleMarkRead(notif.id)}
                            className="text-primary hover:text-primary/80 p-1 rounded-full hover:bg-primary/10 transition-colors shrink-0"
                            title="Marquer comme lue"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-text-muted mt-1">{notif.message}</p>
                      <p className="text-[10px] text-text-muted mt-2 font-medium">
                        {timeAgo(notif.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )})
            )}
          </div>
        </div>
      )}
    </div>
  );
}
