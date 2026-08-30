/**
 * Appearance settings beyond the theme: how the board is drawn, and what colour
 * the discs are.
 *
 * These are strictly cosmetic. Nothing here touches the rules, the geometry, or
 * which squares are playable — a board is always 7×6 with gravity, whatever it
 * looks like.
 *
 * Board style and disc colours both default to `theme`, meaning "follow
 * whichever theme is selected". That keeps the themes coherent out of the box
 * while letting anyone who wants a wooden board with red-and-yellow discs on a
 * dark background have exactly that.
 */

export interface BoardStyle {
  id: string;
  name: string;
  blurb: string;
  /** Extra classes for the board frame. */
  frame: string;
  /** Extra classes for each slot. */
  slot: string;
  /** Gap between slots, so a tighter grid can look like a real grid. */
  gap: string;
  /** Inline styles for the frame, for anything Tailwind cannot express. */
  frameStyle?: Record<string, string>;
}

export const BOARD_STYLES: BoardStyle[] = [
  {
    id: 'theme',
    name: 'Classic',
    blurb: 'Rounded frame, deep holes. Follows your theme.',
    frame: 'rounded-2xl bg-gradient-to-b from-board to-board-deep shadow-2xl ring-1 ring-board-deep/60',
    slot: 'rounded-full',
    gap: 'gap-1 sm:gap-2',
  },
  {
    id: 'grid',
    name: 'Grid',
    blurb: 'Square cells and hairlines. Reads like a diagram.',
    frame: 'rounded-lg bg-board-deep p-1 ring-1 ring-line-2',
    slot: 'rounded-md outline outline-1 outline-board/70 -outline-offset-1',
    gap: 'gap-px',
  },
  {
    id: 'minimal',
    name: 'Outline',
    blurb: 'No frame at all — just the holes.',
    frame: 'rounded-xl bg-transparent ring-1 ring-line',
    slot: 'rounded-full ring-1 ring-line-2',
    gap: 'gap-1.5 sm:gap-2.5',
  },
  {
    id: 'timber',
    name: 'Timber',
    blurb: 'A warm wooden frame, whatever the theme.',
    frame: 'rounded-2xl shadow-2xl ring-1 ring-black/40',
    slot: 'rounded-full',
    gap: 'gap-1 sm:gap-2',
    frameStyle: {
      // Layered gradients rather than an image: no asset to load, and it scales
      // to any board size.
      backgroundImage:
        'repeating-linear-gradient(90deg, rgba(0,0,0,.10) 0 2px, transparent 2px 9px),' +
        'linear-gradient(180deg, #8b5a2b, #5c3a1a)',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    blurb: 'Cool grey stone. Quiet under any theme.',
    frame: 'rounded-2xl shadow-2xl ring-1 ring-black/40',
    slot: 'rounded-full',
    gap: 'gap-1 sm:gap-2',
    frameStyle: {
      backgroundImage: 'linear-gradient(180deg, #4b5563, #1f2937)',
    },
  },
];

export const BOARD_STYLES_BY_ID: Record<string, BoardStyle> = Object.fromEntries(
  BOARD_STYLES.map((style) => [style.id, style]),
);

export interface DiscSet {
  id: string;
  name: string;
  /** `null` means "follow the theme". */
  colours: { p1: [string, string]; p2: [string, string] } | null;
}

export const DISC_SETS: DiscSet[] = [
  { id: 'theme', name: 'Match theme', colours: null },
  {
    id: 'classic',
    name: 'Red & yellow',
    colours: { p1: ['#ef4444', '#b91c1c'], p2: ['#facc15', '#ca8a04'] },
  },
  {
    id: 'sunset',
    name: 'Coral & cream',
    colours: { p1: ['#fb7185', '#be123c'], p2: ['#fde68a', '#d97706'] },
  },
  {
    id: 'ocean',
    name: 'Cyan & sand',
    colours: { p1: ['#22d3ee', '#0e7490'], p2: ['#fcd34d', '#b45309'] },
  },
  {
    id: 'forest',
    name: 'Moss & gold',
    colours: { p1: ['#4ade80', '#15803d'], p2: ['#e0b44a', '#a16207'] },
  },
  {
    id: 'orchid',
    name: 'Violet & mint',
    colours: { p1: ['#c084fc', '#7e22ce'], p2: ['#5eead4', '#0f766e'] },
  },
  {
    id: 'mono',
    name: 'Ink & bone',
    colours: { p1: ['#f8fafc', '#94a3b8'], p2: ['#334155', '#0f172a'] },
  },
];

export const DISC_SETS_BY_ID: Record<string, DiscSet> = Object.fromEntries(
  DISC_SETS.map((set) => [set.id, set]),
);

export interface Appearance {
  themeId: string;
  boardStyleId: string;
  discSetId: string;
}

export const DEFAULT_APPEARANCE: Appearance = {
  themeId: 'midnight',
  boardStyleId: 'theme',
  discSetId: 'theme',
};

export function isBoardStyleId(value: unknown): value is string {
  return typeof value === 'string' && value in BOARD_STYLES_BY_ID;
}

export function isDiscSetId(value: unknown): value is string {
  return typeof value === 'string' && value in DISC_SETS_BY_ID;
}

/**
 * Applies a disc set by overwriting the disc tokens.
 *
 * Writing through the same variables the theme uses means every disc on the
 * site follows — the board, the player bars, the analysis chips, the avatars in
 * the review — rather than only the ones somebody remembered to update.
 */
export function applyDiscSet(set: DiscSet, target: HTMLElement, themeDiscs: {
  p1: string;
  'p1-deep': string;
  p2: string;
  'p2-deep': string;
}): void {
  if (!set.colours) {
    for (const [name, value] of Object.entries(themeDiscs)) {
      target.style.setProperty(`--c-${name}`, value);
    }
    return;
  }

  const rgb = (hex: string) => {
    const clean = hex.replace('#', '');
    const n = parseInt(clean, 16);
    return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
  };

  target.style.setProperty('--c-p1', rgb(set.colours.p1[0]));
  target.style.setProperty('--c-p1-deep', rgb(set.colours.p1[1]));
  target.style.setProperty('--c-p2', rgb(set.colours.p2[0]));
  target.style.setProperty('--c-p2-deep', rgb(set.colours.p2[1]));
}
