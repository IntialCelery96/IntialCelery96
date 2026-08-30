import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GAME_MODES, MODE_IDS, type GameModeId } from '@connect4gg/engine';
import { getSocket, type QueueStatus } from '../lib/socket';
import { api, type PublicUser } from '../lib/api';
import { formatDuration } from '../lib/format';
import { Avatar } from '../components/Avatar';

/**
 * The lobby: pick a time control and queue, or challenge someone directly.
 */
export function PlayPage() {
  const [mode, setMode] = useState<GameModeId>('rapid');
  const [status, setStatus] = useState<QueueStatus | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const socket = getSocket();

    const onStatus = (payload: QueueStatus | null) => setStatus(payload);
    const onMatched = (payload: { gameId: string }) => {
      setSearching(false);
      navigate(`/game/${payload.gameId}`);
    };
    const onError = (payload: { message: string }) => {
      setSearching(false);
      setError(payload.message);
    };
    const onLeft = () => {
      setSearching(false);
      setStatus(null);
    };
    // If the tab was closed mid-game, the server points us straight back.
    const onResume = (payload: { gameId: string }) => navigate(`/game/${payload.gameId}`);

    socket.on('queue:status', onStatus);
    socket.on('game:matched', onMatched);
    socket.on('queue:error', onError);
    socket.on('queue:left', onLeft);
    socket.on('game:resume', onResume);

    return () => {
      socket.off('queue:status', onStatus);
      socket.off('game:matched', onMatched);
      socket.off('queue:error', onError);
      socket.off('queue:left', onLeft);
      socket.off('game:resume', onResume);
    };
  }, [navigate]);

  // Leaving the page should not leave a ghost sitting in the queue.
  useEffect(() => {
    return () => {
      if (searching) getSocket().emit('queue:leave');
    };
  }, [searching]);

  function startSearch(): void {
    setError(null);
    setSearching(true);
    getSocket().emit('queue:join', { mode });
  }

  function cancelSearch(): void {
    getSocket().emit('queue:leave');
    setSearching(false);
    setStatus(null);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section>
        <h1 className="mb-1 text-2xl font-bold">Play</h1>
        <p className="mb-5 text-sm text-ink-3">
          Pick a time control. Each one has its own rating.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {MODE_IDS.map((id) => {
            const info = GAME_MODES[id];
            const selected = mode === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                disabled={searching}
                className={`rounded-xl border p-4 text-left transition disabled:opacity-60 ${
                  selected
                    ? 'border-accent bg-accent/10'
                    : 'border-surface-2 bg-surface/40 hover:border-line-2'
                }`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="font-semibold">{info.name}</span>
                  <span className="font-mono text-sm text-ink-3">{info.label}</span>
                </div>
                <p className="mt-1 text-sm text-ink-3">{info.blurb}</p>
                {!info.rated && (
                  <span className="chip mt-2 bg-surface-2 text-ink-3">unrated</span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-bad/60 px-3 py-2 text-sm text-bad" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6">
          {searching ? (
            <SearchingPanel status={status} onCancel={cancelSearch} />
          ) : (
            <button type="button" onClick={startSearch} className="btn-primary w-full py-3 text-base sm:w-auto sm:px-10">
              Find an opponent
            </button>
          )}
        </div>
      </section>

      <aside className="space-y-4">
        <ChallengePanel disabled={searching} />
        <RecentOpponents />
        <div className="card">
          <h2 className="mb-2 text-sm font-semibold text-ink-2">Practise instead</h2>
          <p className="mb-3 text-sm text-ink-3">
            Six bots, from a punching bag to something that will genuinely beat you.
          </p>
          <Link to="/bots" className="btn-secondary w-full">
            Play a bot
          </Link>
        </div>
      </aside>
    </div>
  );
}

function SearchingPanel({
  status,
  onCancel,
}: {
  status: QueueStatus | null;
  onCancel: () => void;
}) {
  const waited = status?.waitedSeconds ?? 0;
  const band = status?.maxDelta;

  return (
    <div className="card animate-fadeUp">
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 animate-ping rounded-full bg-accent-2" />
        <div className="flex-1">
          <p className="font-medium">
            Searching… <span className="font-mono text-ink-3">{formatDuration(waited)}</span>
          </p>
          <p className="text-sm text-ink-3">
            {band === null || band === undefined
              ? 'Matching with any opponent'
              : `Within ±${band} rating`}
            {waited >= 10 && band !== null && ' — expanding search'}
          </p>
        </div>
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">
          Cancel
        </button>
      </div>

      {status && status.playersWaiting > 1 && (
        <p className="mt-3 text-xs text-ink-4">
          {status.playersWaiting} players waiting in this pool.
        </p>
      )}
    </div>
  );
}

function ChallengePanel({ disabled }: { disabled: boolean }) {
  const [username, setUsername] = useState('');
  const [mode, setMode] = useState<GameModeId>('rapid');
  const [rated, setRated] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const socket = getSocket();
    const onSent = (payload: { to: string | null }) => setMessage(`Challenge sent to ${payload.to}.`);
    const onError = (payload: { message: string }) => setMessage(payload.message);

    socket.on('challenge:sent', onSent);
    socket.on('challenge:error', onError);
    return () => {
      socket.off('challenge:sent', onSent);
      socket.off('challenge:error', onError);
    };
  }, []);

  function send(event: React.FormEvent): void {
    event.preventDefault();
    if (!username.trim()) return;
    setMessage(null);
    getSocket().emit('challenge:send', { username: username.trim(), mode, rated });
    setUsername('');
  }

  return (
    <form onSubmit={send} className="card">
      <h2 className="mb-3 text-sm font-semibold text-ink-2">Challenge a player</h2>

      <input
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        placeholder="Username"
        className="input mb-2"
        disabled={disabled}
        aria-label="Username to challenge"
      />

      <select
        value={mode}
        onChange={(event) => setMode(event.target.value as GameModeId)}
        className="input mb-2"
        disabled={disabled}
        aria-label="Time control"
      >
        {MODE_IDS.map((id) => (
          <option key={id} value={id}>
            {GAME_MODES[id].name} ({GAME_MODES[id].label})
          </option>
        ))}
      </select>

      <label className="mb-3 flex items-center gap-2 text-sm text-ink-3">
        <input
          type="checkbox"
          checked={rated}
          onChange={(event) => setRated(event.target.checked)}
          disabled={disabled || !GAME_MODES[mode].rated}
          className="rounded border-ink-4 bg-surface-2"
        />
        Rated
      </label>

      <button type="submit" className="btn-secondary w-full" disabled={disabled || !username.trim()}>
        Send challenge
      </button>

      {message && <p className="mt-2 text-xs text-ink-3">{message}</p>}
    </form>
  );
}

function RecentOpponents() {
  const [opponents, setOpponents] = useState<PublicUser[]>([]);

  useEffect(() => {
    api
      .get<{ opponents: PublicUser[] }>('/api/recent-opponents')
      .then((data) => setOpponents(data.opponents))
      .catch(() => setOpponents([]));
  }, []);

  if (opponents.length === 0) return null;

  return (
    <div className="card">
      <h2 className="mb-3 text-sm font-semibold text-ink-2">Recent opponents</h2>
      <ul className="space-y-2">
        {opponents.slice(0, 6).map((opponent) => (
          <li key={opponent.id}>
            <Link
              to={`/profile/${opponent.username}`}
              className="flex items-center gap-2 rounded-lg p-1 text-sm hover:bg-surface-2"
            >
              <Avatar
                username={opponent.username}
                avatarUrl={opponent.avatarUrl}
                color={opponent.avatarColor}
                size="xs"
              />
              <span className="truncate">{opponent.username}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
