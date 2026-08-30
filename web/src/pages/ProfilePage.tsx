import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GAME_MODES, RATED_MODE_IDS, type GameModeId } from '@connect4gg/engine';
import { api, type GameSummary, type ProfileResponse } from '../lib/api';
import { countryFlag, describeReason, formatDate, formatRelative } from '../lib/format';
import { Avatar } from '../components/Avatar';
import { RatingChart } from '../components/RatingChart';

export function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<GameModeId>('rapid');
  const [history, setHistory] = useState<{ rating: number; delta: number; at: string }[]>([]);
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    if (!username) return;
    setError(null);
    api
      .get<ProfileResponse>(`/api/users/${username}`)
      .then((data) => {
        setProfile(data);
        setFollowing(data.isFollowing);
      })
      .catch(() => setError('No such player.'));
  }, [username]);

  useEffect(() => {
    if (!username) return;
    api
      .get<{ points: typeof history }>(`/api/users/${username}/history?mode=${chartMode}`)
      .then((data) => setHistory(data.points))
      .catch(() => setHistory([]));
  }, [username, chartMode]);

  async function toggleFollow(): Promise<void> {
    if (!username) return;
    const next = !following;
    // Optimistic: the button should respond immediately.
    setFollowing(next);
    try {
      if (next) await api.post(`/api/users/${username}/follow`);
      else await api.delete(`/api/users/${username}/follow`);
    } catch {
      setFollowing(!next);
    }
  }

  if (error) return <p className="text-center text-ink-3">{error}</p>;
  if (!profile) return <p className="text-center text-ink-3">Loading…</p>;

  const { user, ratings, recentGames } = profile;

  return (
    <div className="space-y-6">
      <header className="card flex flex-col gap-4 sm:flex-row sm:items-center">
        <Avatar
          username={user.username}
          avatarUrl={user.avatarUrl}
          color={user.avatarColor}
          size="lg"
        />

        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            {user.username}
            {user.country && <span aria-hidden>{countryFlag(user.country)}</span>}
          </h1>
          {user.bio && <p className="mt-1 max-w-prose text-sm text-ink-3">{user.bio}</p>}
          <p className="mt-2 text-xs text-ink-4">
            Joined {formatDate(user.createdAt)} · {profile.followers} followers ·{' '}
            {profile.following} following
          </p>
        </div>

        <div className="flex gap-2">
          {profile.isSelf ? (
            <Link to="/settings" className="btn-secondary">
              Edit profile
            </Link>
          ) : (
            <button type="button" onClick={() => void toggleFollow()} className="btn-secondary">
              {following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
      </header>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Ratings</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {ratings.map((rating) => (
            <div key={rating.mode} className="card">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-ink-3">
                  {GAME_MODES[rating.mode as GameModeId]?.name ?? rating.mode}
                </span>
                {rating.provisional && (
                  <span className="chip bg-warn/15 text-warn" title="Fewer than 30 games">
                    provisional
                  </span>
                )}
              </div>
              <div className="mt-1 text-3xl font-bold tabular-nums">{rating.rating}</div>
              <p className="mt-1 text-xs text-ink-4">
                {rating.games} games · {rating.wins}W {rating.losses}L {rating.draws}D
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Rating history</h2>
          <div className="flex gap-1">
            {RATED_MODE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setChartMode(id)}
                className={`rounded px-2 py-1 text-xs font-medium ${
                  chartMode === id ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink-3'
                }`}
              >
                {GAME_MODES[id].name}
              </button>
            ))}
          </div>
        </div>
        <RatingChart points={history} />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent games</h2>
        {recentGames.length === 0 ? (
          <div className="card text-sm text-ink-3">No games played yet.</div>
        ) : (
          <ul className="space-y-2">
            {recentGames.map((game) => (
              <li key={game.id}>
                <GameRow game={game} viewerId={user.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function GameRow({ game, viewerId }: { game: GameSummary; viewerId: string }) {
  const viewerIsPlayer1 = game.player1.user?.id === viewerId;
  const me = viewerIsPlayer1 ? game.player1 : game.player2;
  const them = viewerIsPlayer1 ? game.player2 : game.player1;

  const outcome =
    game.result === 'DRAW'
      ? 'draw'
      : game.result === 'ABORTED'
        ? 'aborted'
        : (game.result === 'PLAYER1_WIN') === viewerIsPlayer1
          ? 'win'
          : 'loss';

  const badge = {
    win: 'bg-good/15 text-good',
    loss: 'bg-bad/15 text-bad',
    draw: 'bg-line-2 text-ink-2',
    aborted: 'bg-surface-2 text-ink-4',
  }[outcome];

  const opponentName = them.user?.username ?? them.botName ?? 'Unknown';

  return (
    <Link
      to={`/replay/${game.id}`}
      className="flex items-center gap-3 rounded-xl border border-surface-2 bg-surface/40 px-4 py-3 transition hover:border-line-2"
    >
      <span className={`chip w-16 justify-center ${badge}`}>{outcome}</span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          vs <span className="font-medium">{opponentName}</span>
          {them.botId && <span className="ml-1 text-xs text-ink-4">(bot)</span>}
        </p>
        <p className="text-xs text-ink-4">
          {GAME_MODES[game.mode as GameModeId]?.name ?? game.mode} ·{' '}
          {game.rated ? 'rated' : 'casual'}
          {describeReason(game.endReason) && ` · ${describeReason(game.endReason)}`}
        </p>
      </div>

      {me.ratingDelta !== null && (
        <span
          className={`text-sm font-medium tabular-nums ${
            me.ratingDelta > 0 ? 'text-good' : me.ratingDelta < 0 ? 'text-bad' : 'text-ink-3'
          }`}
        >
          {me.ratingDelta > 0 ? '+' : ''}
          {me.ratingDelta}
        </span>
      )}

      <span className="hidden text-xs text-ink-4 sm:inline">
        {formatRelative(game.startedAt)}
      </span>
    </Link>
  );
}
