/**
 * Themes.
 *
 * Every colour in the app resolves through these tokens — there are no raw
 * palette classes left in the components — so a theme is a table of values and
 * nothing else. Values are `R G B` triplets rather than hex, because Tailwind
 * composes them as `rgb(var(--c-x) / <alpha-value>)`, which is what lets
 * `bg-surface/60` keep working under every theme.
 *
 * The board and the discs are themed too. That is the point: a Connect 4 board
 * is the largest object on the screen, and leaving it navy-and-primary-colours
 * under a warm or a light theme would make the theme look half-finished.
 */

export interface ThemeTokens {
  /** Page ground. */
  bg: string;
  /** Cards and panels. */
  surface: string;
  /** Raised or hovered surfaces. */
  'surface-2': string;
  /** Default hairline. */
  line: string;
  /** Stronger divider, and the resting state of inputs. */
  'line-2': string;

  /** Primary text. */
  ink: string;
  /** Secondary text — labels, headings inside cards. */
  'ink-2': string;
  /** Supporting text — the bulk of the small copy. */
  'ink-3': string;
  /** Faint text — timestamps, hints. */
  'ink-4': string;

  /** Solid accent: primary buttons, active states. */
  accent: string;
  /** Accent hover. */
  'accent-2': string;
  /** Text and icons sitting on the solid accent. */
  'on-accent': string;
  /** Accent-coloured text on the page ground. Contrast-tuned per theme. */
  'accent-text': string;

  good: string;
  warn: string;
  caution: string;
  bad: string;
  special: string;

  /** The board itself, and the holes punched in it. */
  board: string;
  'board-deep': string;
  slot: string;

  /** First player's disc. */
  p1: string;
  'p1-deep': string;
  /** Second player's disc. */
  p2: string;
  'p2-deep': string;
}

export interface Theme {
  id: string;
  name: string;
  /** One line for the picker — what the theme feels like. */
  blurb: string;
  /** 'dark' | 'light' — drives the native `color-scheme`, so form controls and
   *  scrollbars match rather than staying stubbornly light. */
  scheme: 'dark' | 'light';
  /** Three swatches for the picker: ground, accent, and a disc. */
  swatches: [string, string, string];
  tokens: ThemeTokens;
}

export const THEMES: Theme[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    blurb: 'Cool and quiet. The default.',
    scheme: 'dark',
    swatches: ['#020617', '#0ea5e9', '#ef4444'],
    tokens: {
      bg: '2 6 23',
      surface: '15 23 42',
      'surface-2': '30 41 59',
      line: '30 41 59',
      'line-2': '51 65 85',
      ink: '241 245 249',
      'ink-2': '203 213 225',
      'ink-3': '148 163 184',
      'ink-4': '100 116 139',
      accent: '14 165 233',
      'accent-2': '56 189 248',
      'on-accent': '255 255 255',
      'accent-text': '125 211 252',
      good: '52 211 153',
      warn: '251 191 36',
      caution: '251 146 60',
      bad: '244 63 94',
      special: '232 121 249',
      board: '30 58 138',
      'board-deep': '23 37 84',
      slot: '7 11 20',
      p1: '239 68 68',
      'p1-deep': '185 28 28',
      p2: '250 204 21',
      'p2-deep': '202 138 4',
    },
  },

  {
    id: 'lab',
    name: 'Lab',
    blurb: 'Paper-white and brutalist, with one loud orange.',
    scheme: 'light',
    swatches: ['#f2f1ee', '#f0421f', '#111111'],
    tokens: {
      bg: '242 241 238',
      surface: '255 255 255',
      'surface-2': '232 230 226',
      line: '216 213 207',
      'line-2': '186 182 174',
      ink: '17 17 17',
      'ink-2': '58 56 53',
      'ink-3': '104 100 94',
      'ink-4': '142 138 130',
      accent: '240 66 31',
      'accent-2': '255 92 56',
      'on-accent': '255 255 255',
      // Darkened from the accent: the raw orange fails contrast as text on
      // near-white.
      'accent-text': '188 44 14',
      good: '20 118 78',
      warn: '160 106 6',
      caution: '182 80 14',
      bad: '186 28 42',
      special: '124 52 156',
      board: '24 24 24',
      'board-deep': '10 10 10',
      slot: '48 48 48',
      p1: '240 66 31',
      'p1-deep': '186 40 14',
      p2: '250 250 248',
      'p2-deep': '198 196 190',
    },
  },

  {
    id: 'coquice',
    name: 'Coquice',
    blurb: 'Soft sage and gold. Bright without being loud.',
    scheme: 'light',
    swatches: ['#eaf1ee', '#2d6a5a', '#c9a227'],
    tokens: {
      bg: '234 241 238',
      surface: '255 255 255',
      'surface-2': '223 234 229',
      line: '208 222 216',
      'line-2': '182 201 193',
      ink: '16 40 34',
      'ink-2': '43 72 63',
      'ink-3': '92 119 110',
      'ink-4': '134 157 149',
      accent: '45 106 90',
      'accent-2': '58 130 110',
      'on-accent': '255 255 255',
      'accent-text': '28 80 67',
      good: '30 118 80',
      warn: '162 116 16',
      caution: '176 94 36',
      bad: '176 48 56',
      special: '134 84 154',
      board: '34 74 66',
      'board-deep': '20 50 44',
      slot: '226 236 232',
      p1: '201 162 39',
      'p1-deep': '154 118 18',
      p2: '122 186 166',
      'p2-deep': '70 136 118',
    },
  },

  {
    id: 'formix',
    name: 'Formix',
    blurb: 'Near-black and ember. Warm, close, high contrast.',
    scheme: 'dark',
    swatches: ['#0d0705', '#ff5b1a', '#ffd6aa'],
    tokens: {
      bg: '13 7 5',
      surface: '26 16 12',
      'surface-2': '43 27 20',
      line: '48 31 23',
      'line-2': '76 50 36',
      ink: '255 246 240',
      'ink-2': '226 205 194',
      'ink-3': '170 147 134',
      'ink-4': '124 102 92',
      accent: '255 91 26',
      'accent-2': '255 122 61',
      'on-accent': '28 11 3',
      'accent-text': '255 142 84',
      good: '74 200 130',
      warn: '246 190 66',
      caution: '255 140 40',
      bad: '255 88 88',
      special: '232 130 255',
      board: '60 27 13',
      'board-deep': '34 14 6',
      slot: '18 10 6',
      p1: '255 91 26',
      'p1-deep': '188 55 10',
      p2: '255 214 170',
      'p2-deep': '212 163 114',
    },
  },

  {
    id: 'ruined',
    name: 'Ruined',
    blurb: 'Deep water and old gold. Slow games suit it.',
    scheme: 'dark',
    swatches: ['#081413', '#c8a04a', '#60beb0'],
    tokens: {
      bg: '8 20 19',
      surface: '14 33 31',
      'surface-2': '22 49 45',
      line: '27 59 54',
      'line-2': '42 84 76',
      ink: '234 228 212',
      'ink-2': '200 192 172',
      'ink-3': '150 148 132',
      'ink-4': '110 112 100',
      accent: '200 160 74',
      'accent-2': '224 186 106',
      'on-accent': '14 24 20',
      'accent-text': '216 180 100',
      good: '90 190 140',
      warn: '222 176 80',
      caution: '214 132 60',
      bad: '210 76 76',
      special: '162 132 220',
      board: '16 60 55',
      'board-deep': '8 36 33',
      slot: '6 22 20',
      p1: '200 160 74',
      'p1-deep': '150 114 40',
      p2: '96 190 176',
      'p2-deep': '52 138 126',
    },
  },
];

export const DEFAULT_THEME = 'midnight';

export const THEMES_BY_ID: Record<string, Theme> = Object.fromEntries(
  THEMES.map((theme) => [theme.id, theme]),
);

export function isThemeId(value: unknown): value is string {
  return typeof value === 'string' && value in THEMES_BY_ID;
}

/** Writes a theme's tokens onto an element as CSS custom properties. */
export function applyTheme(theme: Theme, target: HTMLElement): void {
  for (const [name, value] of Object.entries(theme.tokens)) {
    target.style.setProperty(`--c-${name}`, value);
  }
  target.style.setProperty('color-scheme', theme.scheme);
  target.dataset.theme = theme.id;
}
