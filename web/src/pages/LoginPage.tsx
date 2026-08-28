import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const OAUTH_ERRORS: Record<string, string> = {
  google_cancelled: 'Google sign-in was cancelled.',
  google_state: 'That sign-in link expired. Please try again.',
  google_failed: 'Google sign-in failed. Please try again.',
  google_unverified: 'That Google account has no verified email address.',
};

/** Sign in and sign up share a form; `mode` decides which endpoint is called. */
export function LoginPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register, googleEnabled, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const oauthError = params.get('error');
  const isRegister = mode === 'register';

  if (!loading && user) {
    return <Navigate to={user.setupComplete ? '/play' : '/setup'} replace />;
  }

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const account = isRegister ? await register(email, password) : await login(email, password);
      navigate(account.setupComplete ? '/play' : '/setup', { replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : 'Something went wrong. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm py-8">
      <h1 className="mb-1 text-2xl font-bold">{isRegister ? 'Create an account' : 'Sign in'}</h1>
      <p className="mb-6 text-sm text-slate-400">
        {isRegister ? 'Free, and takes a minute.' : 'Welcome back.'}
      </p>

      {oauthError && OAUTH_ERRORS[oauthError] && (
        <p className="mb-4 rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-300" role="alert">
          {OAUTH_ERRORS[oauthError]}
        </p>
      )}

      <form onSubmit={submit} className="card space-y-4">
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="input"
          />
        </div>

        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="input"
          />
          {isRegister && (
            <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-rose-950/60 px-3 py-2 text-sm text-rose-300" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
        </button>

        {googleEnabled && (
          <>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="h-px flex-1 bg-slate-800" />
              or
              <span className="h-px flex-1 bg-slate-800" />
            </div>
            <a href="/api/auth/google" className="btn-secondary w-full">
              Continue with Google
            </a>
          </>
        )}
      </form>

      <p className="mt-4 text-center text-sm text-slate-400">
        {isRegister ? 'Already have an account? ' : "Don't have an account? "}
        <Link to={isRegister ? '/login' : '/register'} className="text-sky-400 hover:underline">
          {isRegister ? 'Sign in' : 'Sign up'}
        </Link>
      </p>
    </div>
  );
}
