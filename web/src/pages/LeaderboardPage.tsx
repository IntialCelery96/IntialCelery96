import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GAME_MODES, RATED_MODE_IDS, type GameModeId } from '@connect4gg/engine';
import { api, type LeaderboardEntry } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { countryFlag } from '../lib/format';

export function LeaderboardPage() {
  const [mode, setMode] = useState<GameModeId>('rapid');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<{ entries: LeaderboardEntry[] }>(`/api/leaderboard/${mode}`)
      .then((data) => setEntries(data.entries))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [mode]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Leaderboard</h1>
      <p className="mb-5 text-sm text-slate-400">
        Top players by rating. Provisional accounts (under 30 games) are not listed.
      </p>

      <div className="mb-4 flex gap-2">
        {RATED_MODE_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              mode === id ? 'bg-sky-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {GAME_MODES[id].name}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-slate-400">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="card text-center text-slate-400">
          <p>No ranked players in {GAME_MODES[mode].name} yet.</p>
          <p className="mt-1 text-sm text-slate-500">
            Play 30 rated games in this mode to appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Player</th>
                <th className="px-4 py-3 text-right">Rating</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">Peak</th>
                <th className="hidden px-4 py-3 text-right sm:table-cell">W/L/D</th>
                <th className="px-4 py-3 text-right">Games</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {entries.map((entry) => (
                <tr key={entry.userId} className="hover:bg-slate-900/60">
                  <td className="px-4 py-3 font-mono text-slate-400">{entry.rank}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/profile/${entry.username}`}
                      className="flex items-center gap-2 font-medium hover:text-sky-300"
                    >
                      <Avatar
                        username={entry.username}
                        avatarUrl={entry.avatarUrl}
                        color={entry.avatarColor}
                        size="xs"
                      />
                      <span className="truncate">{entry.username}</span>
                      {entry.country && <span aria-hidden>{countryFlag(entry.country)}</span>}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{entry.rating}</td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-slate-400 sm:table-cell">
                    {entry.peak}
                  </td>
                  <td className="hidden px-4 py-3 text-right tabular-nums text-slate-400 sm:table-cell">
                    {entry.wins}/{entry.losses}/{entry.draws}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-400">{entry.games}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
