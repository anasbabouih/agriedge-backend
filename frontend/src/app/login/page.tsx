'use client';

import { useState } from 'react';
import { gql, useMutation } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Leaf, Loader2, AlertCircle, Eye, EyeOff, Shield, UserCheck, Briefcase, User, Building } from 'lucide-react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

const TOKEN_AUTH_MUTATION = gql`
  mutation TokenAuth($username: String!, $password: String!) {
    tokenAuth(username: $username, password: $password) {
      token
      payload
    }
  }
`;

const SSO_LOGIN_MUTATION = gql`
  mutation SSOLogin($idToken: String!) {
    ssoLogin(idToken: $idToken) {
      token
      success
      error
    }
  }
`;

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  const [tokenAuth, { loading: basicLoading }] = useMutation(TOKEN_AUTH_MUTATION, {
    onCompleted: (data) => {
      localStorage.setItem('token', data.tokenAuth.token);
      router.push('/dashboard');
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Identifiants invalides');
    }
  });

  const [ssoLogin, { loading: ssoLoading }] = useMutation(SSO_LOGIN_MUTATION, {
    onCompleted: (data) => {
      if (data.ssoLogin.success) {
        localStorage.setItem('token', data.ssoLogin.token);
        router.push('/dashboard');
      } else {
        setErrorMsg(data.ssoLogin.error || 'Erreur SSO');
      }
    },
    onError: (error) => {
      setErrorMsg(error.message || 'Échec de la connexion SSO');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    tokenAuth({ variables: { username, password } });
  };

  const handleQuickLogin = (userRole: string) => {
    setErrorMsg('');
    tokenAuth({ variables: { username: userRole, password: 'password123' } });
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-background">
      {/* Dynamic Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] opacity-70" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary-dark/20 rounded-full blur-[100px] opacity-70" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="w-full max-w-lg p-8 glass rounded-3xl z-10 mx-4"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-3">
            <Leaf className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-text-main tracking-tight">AgriEdge</h1>
          <p className="text-text-muted mt-1 text-sm font-medium">Système de Gestion des Congés</p>
        </div>

        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">{errorMsg}</p>
          </motion.div>
        )}

        {/* Quick Role Login Buttons */}
        <div className="mb-6 space-y-2.5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider text-center mb-2">
            Connexion Rapide (Comptes de Test)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleQuickLogin('admin')}
              disabled={basicLoading}
              className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-colors text-xs font-medium text-text-main"
            >
              <Shield className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Administrateur</span>
            </button>

            <button
              onClick={() => handleQuickLogin('rh')}
              disabled={basicLoading}
              className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-colors text-xs font-medium text-text-main"
            >
              <Briefcase className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Responsable RH</span>
            </button>

            <button
              onClick={() => handleQuickLogin('manager')}
              disabled={basicLoading}
              className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-colors text-xs font-medium text-text-main"
            >
              <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Manager N1</span>
            </button>

            <button
              onClick={() => handleQuickLogin('employee')}
              disabled={basicLoading}
              className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-colors text-xs font-medium text-text-main"
            >
              <User className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Employé (Anas)</span>
            </button>
          </div>
          <button
            onClick={() => handleQuickLogin('dg')}
            disabled={basicLoading}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover transition-colors text-xs font-medium text-text-main"
          >
            <Building className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Directeur Général (DG)</span>
          </button>
        </div>

        <div className="relative flex items-center py-3">
          <div className="flex-grow border-t border-border"></div>
          <span className="flex-shrink-0 mx-4 text-text-muted text-xs uppercase tracking-wider">Ou connexion classique</span>
          <div className="flex-grow border-t border-border"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5" htmlFor="username">
              Identifiant / Nom d'utilisateur
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-premium"
              placeholder="admin, rh, manager, employee..."
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5" htmlFor="password">
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-premium w-full pr-10"
                placeholder="••••••••"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-main transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={basicLoading}
            className="btn-primary w-full mt-2 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {basicLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Connexion en cours...</span>
              </>
            ) : (
              <span>Se Connecter</span>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "mock-client-id"}>
      <LoginForm />
    </GoogleOAuthProvider>
  );
}
