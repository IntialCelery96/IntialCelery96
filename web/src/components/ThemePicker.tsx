import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../theme/ThemeProvider';

/**
 * Theme chooser.
 *
 * Each option previews itself with three swatches — the page ground, the
 * accent, and a disc — because a theme name tells you nothing and a Connect 4
 * board is mostly ground and discs.
 */
export function ThemePicker({ variant = 'menu' }: { variant?: 'menu' | 'grid' }) {
  const { theme, themes, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (variant === 'grid') {
    return (
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
            <Swatches theme={option} size="lg" />
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{option.name}</span>
              <span className="block truncate text-xs text-ink-4">{option.blurb}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink-3 transition hover:bg-surface-2 hover:text-ink"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Theme: ${theme.name}`}
      >
        <Swatches theme={theme} size="sm" />
        <span className="hidden md:inline">{theme.name}</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-2 w-60 animate-fadeUp rounded-xl border border-line bg-surface p-1.5 shadow-2xl"
        >
          {themes.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitemradio"
              aria-checked={option.id === theme.id}
              onClick={() => {
                setTheme(option.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${
                option.id === theme.id ? 'bg-accent/12' : 'hover:bg-surface-2'
              }`}
            >
              <Swatches theme={option} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{option.name}</span>
                <span className="block truncate text-xs text-ink-4">{option.blurb}</span>
              </span>
              {option.id === theme.id && (
                <span className="text-accent-text" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Swatches({
  theme,
  size,
}: {
  theme: { swatches: [string, string, string]; name: string };
  size: 'sm' | 'lg';
}) {
  const box = size === 'sm' ? 'h-5 w-5' : 'h-9 w-9';
  return (
    <span
      className={`flex shrink-0 overflow-hidden rounded-md ring-1 ring-line-2 ${box}`}
      aria-hidden="true"
    >
      {theme.swatches.map((colour, i) => (
        <span key={i} className="flex-1" style={{ backgroundColor: colour }} />
      ))}
    </span>
  );
}
