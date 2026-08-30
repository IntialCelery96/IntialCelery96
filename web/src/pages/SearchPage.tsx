import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type PublicUser } from '../lib/api';
import { Avatar } from '../components/Avatar';
import { countryFlag } from '../lib/format';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [input, setInput] = useState(query);
  const [results, setResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    api
      .get<{ users: PublicUser[] }>(`/api/search/users?q=${encodeURIComponent(query)}`)
      .then((data) => setResults(data.users))
      .catch(() => setResults([]))
      .finally(() => setSearching(false));
  }, [query]);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-2xl font-bold">Find a player</h1>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          setParams(input.trim() ? { q: input.trim() } : {});
        }}
        className="mb-6 flex gap-2"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Username"
          className="input"
          aria-label="Search by username"
        />
        <button type="submit" className="btn-primary shrink-0">
          Search
        </button>
      </form>

      {query.length >= 2 && !searching && results.length === 0 && (
        <p className="text-sm text-ink-3">No players found starting with "{query}".</p>
      )}

      <ul className="space-y-2">
        {results.map((user) => (
          <li key={user.id}>
            <Link
              to={`/profile/${user.username}`}
              className="flex items-center gap-3 rounded-xl border border-surface-2 bg-surface/40 px-4 py-3 transition hover:border-line-2"
            >
              <Avatar
                username={user.username}
                avatarUrl={user.avatarUrl}
                color={user.avatarColor}
                size="sm"
              />
              <span className="flex-1 font-medium">{user.username}</span>
              {user.country && <span aria-hidden>{countryFlag(user.country)}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
