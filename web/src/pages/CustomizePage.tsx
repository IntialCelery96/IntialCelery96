import { useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { applyMove, createGame, type GameState } from '@connect4gg/engine';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeProvider';
import { Board } from '../components/Board';

/**
 * Look and feel: theme, board style, disc colours.
 *
 * Kept apart from account settings because these are a different kind of
 * decision — nobody comes here to change their username. The live board at the
 * top is the point of the page: every option changes what the board looks like,
 * so the board is what you should be looking at while you choose.
 *
 * Nothing here touches the rules. A board is 7×6 with gravity under every
 * style; only the paint changes.
 */
export function CustomizePage() {
  const { user, loading } = useAuth();
  const { theme, themes, setTheme, boardStyle, boardStyles, setBoardStyle, discSet, discSets, setDiscSet } =
    useTheme();

  // A position with both colours, a stack, and empty holes — enough to judge
  // any of these choices by.
  const [preview] = useState<GameState>(() =>
    [3, 3, 4, 2, 4, 5, 2].reduce<GameState>((state, column) => applyMove(state, column), createGame()),
  );

  const highlight = useMemo(() => preview.winningLine ?? undefined, [preview]);

  if (loading) return <p className="py-20 text-center text-ink-3">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="mx-auto max-w-3xl py-2">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-bold">Customize</h1>
        <Link to="/settings" className="text-sm text-accent-text hover:underline">
          Account settings
        </Link>
      </div>
      <p className="mb-6 text-sm text-ink-3">
        Purely cosmetic — the rules never change. Saved to this browser.
      </p>

      {/* Compact on purpose: the preview has to share the screen with the
          options that change it, or you are scrolling back and forth to see
          what a choice did. */}
      <div className="card sticky top-16 z-10 mb-6 flex justify-center bg-surface/95 backdrop-blur">
        <Board board={preview.board} highlight={highlight} compact label="Appearance preview" />
      </div>

      <section className="card mb-5">
        <h2 className="mb-1 text-sm font-semibold text-ink-2">Theme</h2>
        <p className="mb-3 text-xs text-ink-4">Sets every colour on the site, board included.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {themes.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setTheme(option.id)}
              aria-pressed={option.id === theme.id}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                option.id === theme.id
                  ? 'border-accent bg-accent/10'
                  : 'border-line bg-surface hover:border-line-2'
              }`}
            >
              <span
                className="flex h-9 w-9 shrink-0 overflow-hidden rounded-md ring-1 ring-line-2"
                aria-hidden="true"
              >
                {option.swatches.map((colour, i) => (
                  <span key={i} className="flex-1" style={{ backgroundColor: colour }} />
                ))}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{option.name}</span>
                <span className="block truncate text-xs text-ink-4">{option.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="card mb-5">
        <h2 className="mb-1 text-sm font-semibold text-ink-2">Board style</h2>
        <p className="mb-3 text-xs text-ink-4">
          How the frame and the holes are drawn. The board is 7×6 either way.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {boardStyles.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setBoardStyle(option.id)}
              aria-pressed={option.id === boardStyle.id}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                option.id === boardStyle.id
                  ? 'border-accent bg-accent/10'
                  : 'border-line bg-surface hover:border-line-2'
              }`}
            >
              <BoardSwatch style={option} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{option.name}</span>
                <span className="block truncate text-xs text-ink-4">{option.blurb}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-1 text-sm font-semibold text-ink-2">Discs</h2>
        <p className="mb-3 text-xs text-ink-4">
          Applies everywhere a player is identified, not only on the board.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {discSets.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setDiscSet(option.id)}
              aria-pressed={option.id === discSet.id}
              className={`flex items-center gap-2 rounded-xl border p-2.5 text-left transition ${
                option.id === discSet.id
                  ? 'border-accent bg-accent/10'
                  : 'border-line bg-surface hover:border-line-2'
              }`}
            >
              <span className="flex shrink-0 gap-1" aria-hidden="true">
                <span
                  className="h-5 w-5 rounded-full"
                  style={{
                    background: option.colours
                      ? `linear-gradient(140deg, ${option.colours.p1[0]}, ${option.colours.p1[1]})`
                      : 'linear-gradient(140deg, rgb(var(--c-p1)), rgb(var(--c-p1-deep)))',
                  }}
                />
                <span
                  className="h-5 w-5 rounded-full"
                  style={{
                    background: option.colours
                      ? `linear-gradient(140deg, ${option.colours.p2[0]}, ${option.colours.p2[1]})`
                      : 'linear-gradient(140deg, rgb(var(--c-p2)), rgb(var(--c-p2-deep)))',
                  }}
                />
              </span>
              <span className="truncate text-xs font-medium">{option.name}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/** A three-hole miniature of a board style, drawn from the same classes. */
function BoardSwatch({ style }: { style: { frame: string; slot: string; frameStyle?: Record<string, string> } }) {
  return (
    <span
      className={`flex h-9 w-12 shrink-0 items-center justify-center gap-0.5 p-1 ${style.frame}`}
      style={style.frameStyle}
      aria-hidden="true"
    >
      <span className={`h-4 w-4 bg-slot ${style.slot}`} />
      <span className={`h-4 w-4 bg-p1 ${style.slot}`} />
      <span className={`h-4 w-4 bg-p2 ${style.slot}`} />
    </span>
  );
}
