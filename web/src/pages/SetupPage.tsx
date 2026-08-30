import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError, api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { AvatarPicker } from '../components/AvatarPicker';

/**
 * One-time account setup: claim a username and optionally add a photo.
 *
 * Everything except the username is skippable. Forcing a new player through a
 * long form before their first game is the fastest way to lose them.
 */
export function SetupPage() {
  const { user, refresh, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('');
  const [available, setAvailable] = useState<{ ok: boolean; reason: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarPreset, setAvatarPreset] = useState<string | null>(null);
  const navigate = useNavigate();

  // Debounced availability check, so the field answers as you type without
  // firing a request per keystroke.
  useEffect(() => {
    if (username.length < 3) {
      setAvailable(null);
      return;
    }

    const timer = setTimeout(() => {
      api
        .get<{ available: boolean; reason: string | null }>(
          `/api/username-available?username=${encodeURIComponent(username)}`,
        )
        .then((data) => setAvailable({ ok: data.available, reason: data.reason }))
        .catch((caught) =>
          setAvailable({
            ok: false,
            reason: caught instanceof ApiError ? caught.message : 'Could not check that name',
          }),
        );
    }, 350);

    return () => clearTimeout(timer);
  }, [username]);

  if (loading) return <p className="py-20 text-center text-ink-3">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.setupComplete) return <Navigate to="/play" replace />;

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await api.post('/api/setup', {
        username: username.trim(),
        ...(bio.trim() ? { bio: bio.trim() } : {}),
        ...(country.trim() ? { country: country.trim() } : {}),
        ...(avatarPreset ? { avatarPreset } : {}),
      });
      await refresh();
      navigate('/play', { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not save your profile.');
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = username.length >= 3 && available?.ok === true && !submitting;

  return (
    <div className="mx-auto max-w-lg py-8">
      <h1 className="mb-1 text-2xl font-bold">Set up your profile</h1>
      <p className="mb-6 text-sm text-ink-3">
        Pick a username — this is how other players will see you.
      </p>

      <form onSubmit={submit} className="card space-y-5">
        <div>
          <label htmlFor="username" className="label">
            Username
          </label>
          <input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="input"
            autoComplete="username"
            required
            minLength={3}
            maxLength={20}
            autoFocus
            aria-describedby="username-status"
          />
          <p id="username-status" className="mt-1 text-xs" role="status">
            {username.length < 3 ? (
              <span className="text-ink-4">3-20 characters, letters and numbers.</span>
            ) : available === null ? (
              <span className="text-ink-4">Checking…</span>
            ) : available.ok ? (
              <span className="text-good">{username} is available.</span>
            ) : (
              <span className="text-bad">{available.reason}</span>
            )}
          </p>
        </div>

        <div>
          <span className="label">Avatar</span>
          <p className="mb-3 text-xs text-ink-4">
            Pick one — you can change it later.
          </p>
          <AvatarPicker
            value={avatarUrl ?? (avatarPreset ? `avatar:${avatarPreset}` : null)}
            onSelectPreset={(id) => {
              setAvatarPreset(id);
              setAvatarUrl(null);
            }}
            onUploaded={(url) => {
              setAvatarUrl(url);
              setAvatarPreset(null);
            }}
          />
        </div>

        <div>
          <label htmlFor="bio" className="label">
            Bio <span className="font-normal text-ink-4">(optional)</span>
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            className="input min-h-20 resize-y"
            maxLength={300}
            placeholder="Anything you'd like other players to know."
          />
        </div>

        <div>
          <label htmlFor="country" className="label">
            Country <span className="font-normal text-ink-4">(optional)</span>
          </label>
          <input
            id="country"
            value={country}
            onChange={(event) => setCountry(event.target.value.toUpperCase().slice(0, 2))}
            className="input w-24 uppercase"
            placeholder="US"
            maxLength={2}
          />
          <p className="mt-1 text-xs text-ink-4">Two-letter country code.</p>
        </div>

        {error && (
          <p className="rounded-lg bg-bad/60 px-3 py-2 text-sm text-bad" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={!canSubmit}>
          {submitting ? 'Saving…' : 'Start playing'}
        </button>
      </form>
    </div>
  );
}
