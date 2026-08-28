import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Avatar } from './Avatar';
import { ChallengeToasts } from './ChallengeToasts';

const NAV = [
  { to: '/play', label: 'Play' },
  { to: '/bots', label: 'Bots' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/learn', label: 'Learn' },
];

export function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Link to="/" className="mr-2 flex items-center gap-2 font-bold tracking-tight">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-red-disc to-yellow-disc text-sm">
              ●
            </span>
            <span className="hidden sm:inline">Connect4.gg</span>
          </Link>

          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {user?.setupComplete ? (
            <div className="flex items-center gap-2">
              <Link
                to={`/profile/${user.username}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-slate-800"
              >
                <Avatar username={user.username} avatarUrl={user.avatarUrl} size="sm" />
                <span className="hidden text-sm font-medium sm:inline">{user.username}</span>
              </Link>
              <button type="button" onClick={() => void logout()} className="btn-ghost text-xs">
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" className="btn-ghost text-sm">
                Sign in
              </Link>
              <Link to="/register" className="btn-primary text-sm">
                Sign up
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        Connect4.gg — ranked Connect 4.{' '}
        <Link to="/learn" className="hover:text-slate-300">
          Learn the game
        </Link>
      </footer>

      {/* Challenges can arrive on any screen, so the listener lives here. */}
      {user?.setupComplete && <ChallengeToasts />}
    </div>
  );
}
