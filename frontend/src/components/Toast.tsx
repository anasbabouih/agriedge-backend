'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

// ─── Context ─────────────────────────────────────────────────────────────────
const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Config ──────────────────────────────────────────────────────────────────
const toastConfig: Record<ToastType, { icon: any; bar: string; bg: string; border: string; text: string }> = {
  success: {
    icon: CheckCircle,
    bar: 'bg-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
  },
  error: {
    icon: XCircle,
    bar: 'bg-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    text: 'text-red-400',
  },
  warning: {
    icon: AlertTriangle,
    bar: 'bg-amber-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
  },
  info: {
    icon: Info,
    bar: 'bg-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
  },
};

// ─── Single Toast Item ────────────────────────────────────────────────────────
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const config = toastConfig[toast.type];
  const Icon = config.icon;
  const duration = toast.duration ?? 4000;

  useEffect(() => {
    const t = setTimeout(() => onRemove(toast.id), duration);
    return () => clearTimeout(t);
  }, [toast.id, duration, onRemove]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      className={`relative flex items-start gap-3 w-[340px] rounded-2xl border shadow-2xl shadow-black/20 overflow-hidden p-4 ${config.bg} ${config.border} backdrop-blur-xl`}
    >
      {/* Colored left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.bar} rounded-l-2xl`} />

      <div className={`mt-0.5 shrink-0 ${config.text}`}>
        <Icon className="w-5 h-5" />
      </div>

      <p className="text-sm font-medium text-text-main flex-1 leading-snug pr-2">
        {toast.message}
      </p>

      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 text-text-muted hover:text-text-main transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Auto-dismiss progress bar */}
      <motion.div
        className={`absolute bottom-0 left-0 h-0.5 ${config.bar} opacity-40`}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: duration / 1000, ease: 'linear' }}
      />
    </motion.div>
  );
}

// ─── Toast Container ──────────────────────────────────────────────────────────
function ToastContainer({ toasts, remove }: { toasts: Toast[]; remove: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end">
      <AnimatePresence mode="popLayout">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onRemove={remove} />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message: string, type: ToastType = 'info', duration?: number) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev.slice(-4), { id, type, message, duration }]);
  }, []);

  const value: ToastContextValue = {
    toast,
    success: (m) => toast(m, 'success'),
    error: (m) => toast(m, 'error'),
    warning: (m) => toast(m, 'warning'),
    info: (m) => toast(m, 'info'),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} remove={remove} />
    </ToastContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
