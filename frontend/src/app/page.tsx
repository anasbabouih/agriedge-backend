'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-background text-text-main">
      <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
      <p className="text-sm font-medium text-text-muted">Redirection vers AgriEdge...</p>
    </div>
  );
}
