import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Route guard. Sends signed-out visitors to the login screen and half-finished
 * accounts to the setup screen, so no page has to defend against a user with
 * no username.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <p className="py-20 text-center text-slate-400">Loading…</p>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!user.setupComplete) {
    return <Navigate to="/setup" replace />;
  }

  return <>{children}</>;
}
