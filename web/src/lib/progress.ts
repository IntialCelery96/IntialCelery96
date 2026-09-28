import { api } from './api';

/**
 * Curriculum progress on the client.
 *
 * The state is the set of solved puzzle slugs; the engine derives everything
 * else (`curriculumProgress`). The browser always keeps a copy, so an
 * anonymous reader can work through the path, and the demo build — which has
 * no server — works the same way. When the reader is signed in the account is
 * the source of truth: the local copy is merged into it once and then mirrors
 * it, so signing in on a second device picks up where the first left off.
 */

const KEY = 'c4gg.puzzles.solved';

export function readLocalSolved(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function writeLocalSolved(solved: readonly string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(solved)]));
  } catch {
    // Storage unavailable: progress lives for the session only.
  }
}

/**
 * The solved set for this reader. Signed in, this reconciles the browser's
 * copy with the account and returns the merged result; the account is never
 * shrunk by a browser that knows less.
 */
export async function loadSolved(signedIn: boolean): Promise<string[]> {
  const local = readLocalSolved();
  if (!signedIn) return local;

  try {
    const remote = await api.get<{ solved: string[] }>('/api/learn/progress');
    const missing = local.filter((slug) => !remote.solved.includes(slug));
    const merged =
      missing.length > 0
        ? (await api.post<{ solved: string[] }>('/api/learn/progress', { solved: missing })).solved
        : remote.solved;
    writeLocalSolved(merged);
    return merged;
  } catch {
    return local;
  }
}

/** Records a solve locally. The server records its own copy when it grades. */
export function recordSolved(slug: string): string[] {
  const next = [...new Set([...readLocalSolved(), slug])];
  writeLocalSolved(next);
  return next;
}
