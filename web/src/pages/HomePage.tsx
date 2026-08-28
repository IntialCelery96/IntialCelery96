import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GAME_MODES, MODE_IDS, type GameModeId } from '@connect4gg/engine';
import { api, type GameSummary } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatRelative } from '../lib/format';

export function HomePage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<{ players: number; games: number } | null>(null);
  const [recent, setRecent] = useState<GameSummary[]>([]);

  useEffect(() => {
    api
      .get<{ players: number; games: number }>('/api/stats')
      .then(setStats)
      .catch(() => undefined);
    api
      .get<{ games: GameSummary[] }>('/api/games/recent/all')
      .then((data) => setRecent(data.games))
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-12 py-6">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Connect 4, played{' '}
          <span className="bg-gradient-to-r from-red-disc to-yellow-disc bg-clip-text text-transparent">
            properly
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-slate-400">
          Ranked games against real opponents, ELO ratings for every time control, and bots to
          train against. Free, and no download.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {user?.setupComplete ? (
            <Link to="/play" className="btn-primary px-8 py-3 text-base">
              Play now
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn-primary px-8 py-3 text-base">
                Create an account
              </Link>
              <Link to="/login" className="btn-secondary px-8 py-3 text-base">
                Sign in
              </Link>
            </>
          )}
          <Link to="/local" className="btn-ghost px-6 py-3 text-base">
            Play on one screen
          </Link>
        </div>

        {stats && (
          <p className="mt-6 text-sm text-slate-500">
            {stats.players.toLocaleString()} players · {stats.games.toLocaleString()} games played
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-center text-lg font-semibold">Four ways to play</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MODE_IDS.map((id: GameModeId) => {
            const mode = GAME_MODES[id];
            return (
              <div key={id} className="card">
                <div className="flex items-baseline justify-between">
                  <h3 className="font-semibold">{mode.name}</h3>
                  <span className="font-mono text-sm text-slate-400">{mode.label}</span>
                </div>
                <p className="mt-1 text-sm text-slate-400">{mode.blurb}</p>
              </div>
            );
          })}
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Recent games</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {recent.slice(0, 6).map((game) => {
              const p1 = game.player1.user?.username ?? game.player1.botName ?? '?';
              const p2 = game.player2.user?.username ?? game.player2.botName ?? '?';
              return (
                <li key={game.id}>
                  <Link
                    to={`/replay/${game.id}`}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3 text-sm transition hover:border-slate-700"
                  >
                    <span className="truncate">
                      <span className={game.result === 'PLAYER1_WIN' ? 'font-semibold' : ''}>{p1}</span>
                      <span className="mx-2 text-slate-600">vs</span>
                      <span className={game.result === 'PLAYER2_WIN' ? 'font-semibold' : ''}>{p2}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-500">
                      {game.endedAt ? formatRelative(game.endedAt) : ''}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
