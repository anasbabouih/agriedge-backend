'use client';

import { useState } from 'react';
import { gql, useMutation } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Leaf, Loader2, AlertCircle, Eye, EyeOff } from 'lucide-react';

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

import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';

export function LoginForm() {
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
      setErrorMsg(error.message || 'Invalid credentials');
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
      setErrorMsg(error.message || 'SSO failed');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    tokenAuth({ variables: { username, password } });
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
        className="w-full max-w-md p-8 glass rounded-3xl z-10 mx-4"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
            <Leaf className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-text-main tracking-tight">AgriEdge</h1>
          <p className="text-text-muted mt-2 text-sm font-medium">Leave Management System</p>
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

        {/* SSO Section */}
        <div className="mb-6 space-y-3">
          <GoogleLogin
            onSuccess={credentialResponse => {
              if (credentialResponse.credential) {
                ssoLogin({ variables: { idToken: credentialResponse.credential } });
              }
            }}
            onError={() => {
              setErrorMsg('La connexion Google a échoué.');
            }}
            theme="filled_black"
            text="continue_with"
            shape="pill"
          />
          
          {/* Mock SSO Button for Development Testing without real Google Client ID */}
          <button
            onClick={() => ssoLogin({ variables: { idToken: 'mock_google_token_admin' } })}
            disabled={ssoLoading}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-full border border-border bg-surface hover:bg-surface-hover transition-colors text-sm font-medium"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuer avec l'e-mail d'entreprise (Mock Admin)
          </button>
          
          <button
            onClick={() => ssoLogin({ variables: { idToken: 'mock_google_token_manager' } })}
            disabled={ssoLoading}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-full border border-border bg-surface hover:bg-surface-hover transition-colors text-sm font-medium"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuer avec l'e-mail d'entreprise (Mock Manager N1)
          </button>
        </div>

        <div className="relative flex items-center py-5">
          <div className="flex-grow border-t border-border"></div>
          <span className="flex-shrink-0 mx-4 text-text-muted text-sm">Ou connexion classique</span>
          <div className="flex-grow border-t border-border"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1.5" htmlFor="username">
              Identifiant
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input-premium"
              placeholder="Ex: AE123 ou test_emp"
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
