import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError, api, type ProfileResponse, type PublicUser } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { AvatarUpload } from '../components/AvatarUpload';
import { ThemePicker } from '../components/ThemePicker';

export function SettingsPage() {
  const { user, refresh, loading } = useAuth();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.username) return;
    api
      .get<ProfileResponse>(`/api/users/${user.username}`)
      .then((data) => {
        setProfile(data);
        setUsername(data.user.username ?? '');
        setBio(data.user.bio ?? '');
        setCountry(data.user.country ?? '');
      })
      .catch(() => setMessage({ kind: 'error', text: 'Could not load your profile.' }));
  }, [user?.username]);

  if (loading) return <p className="py-20 text-center text-ink-3">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.setupComplete) return <Navigate to="/setup" replace />;

  async function save(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await api.patch('/api/profile', {
        ...(username !== profile?.user.username ? { username: username.trim() } : {}),
        bio: bio.trim() || null,
        country: country.trim() || null,
      });
      await refresh();
      setMessage({ kind: 'ok', text: 'Profile saved.' });
    } catch (caught) {
      setMessage({
        kind: 'error',
        text: caught instanceof ApiError ? caught.message : 'Could not save your profile.',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg py-4">
      <h1 className="mb-6 text-2xl font-bold">Settings</h1>

      <section className="card mb-5">
        <h2 className="mb-1 text-sm font-semibold text-ink-2">Theme</h2>
        <p className="mb-3 text-xs text-ink-4">
          Applies everywhere, including the board. Saved to this browser.
        </p>
        <ThemePicker variant="grid" />
      </section>

      <form onSubmit={save} className="card space-y-5">
        <div>
          <span className="label">Profile photo</span>
          <AvatarUpload
            username={user.username}
            avatarUrl={user.avatarUrl}
            onUploaded={(updated: PublicUser) => {
              void refresh();
              setProfile((prev) => (prev ? { ...prev, user: updated } : prev));
            }}
          />
        </div>

        <div>
          <label htmlFor="username" className="label">
            Username
          </label>
          <input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className="input"
            minLength={3}
            maxLength={20}
          />
          <p className="mt-1 text-xs text-ink-4">
            You can change your username once every 30 days.
          </p>
        </div>

        <div>
          <label htmlFor="bio" className="label">
            Bio
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            className="input min-h-20 resize-y"
            maxLength={300}
          />
          <p className="mt-1 text-xs text-ink-4">{bio.length}/300</p>
        </div>

        <div>
          <label htmlFor="country" className="label">
            Country
          </label>
          <input
            id="country"
            value={country}
            onChange={(event) => setCountry(event.target.value.toUpperCase().slice(0, 2))}
            className="input w-24 uppercase"
            maxLength={2}
          />
        </div>

        {message && (
          <p
            className={`rounded-lg px-3 py-2 text-sm ${
              message.kind === 'ok'
                ? 'bg-good/60 text-good'
                : 'bg-bad/60 text-bad'
            }`}
            role="status"
          >
            {message.text}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
