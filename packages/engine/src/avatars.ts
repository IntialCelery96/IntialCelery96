/**
 * The default avatar set.
 *
 * Lives in the engine package so the server and the client agree on what a
 * valid avatar id is — the server has to validate the choice, and the client
 * has to draw it, and those two must not drift.
 *
 * Every avatar is drawn from the same parts: a disc, a board fragment, or a
 * simple face, in one of a fixed set of colourways. They are deliberately
 * abstract. Presets exist so that a player never has to upload a photograph to
 * look like somebody, which is the single biggest lever on keeping a profile
 * page safe for all ages.
 */

export type AvatarShape =
  | 'disc'
  | 'stack'
  | 'four'
  | 'column'
  | 'diagonal'
  | 'grid'
  | 'split'
  | 'ring'
  | 'wave'
  | 'spark';

export interface AvatarPreset {
  /** Stable id, stored on the user row as `avatar:<id>`. */
  id: string;
  shape: AvatarShape;
  /** Background and the two mark colours. */
  colours: [string, string, string];
  /** Used as the option's accessible name. */
  label: string;
}

const PALETTES: [string, string, string][] = [
  ['#1e3a8a', '#ef4444', '#facc15'], // classic board
  ['#0f172a', '#38bdf8', '#e2e8f0'], // midnight
  ['#111111', '#f0421f', '#f5f5f2'], // brutalist
  ['#224a42', '#c9a227', '#7abaa6'], // sage and gold
  ['#2b1208', '#ff5b1a', '#ffd6aa'], // ember
  ['#0f3c37', '#c8a04a', '#60beb0'], // deep water
  ['#3b0764', '#c084fc', '#fbcfe8'], // violet
  ['#052e2b', '#2dd4bf', '#fef3c7'], // teal
];

const SHAPES: AvatarShape[] = [
  'disc', 'stack', 'four', 'column', 'diagonal', 'grid', 'split', 'ring', 'wave', 'spark',
];

const SHAPE_LABELS: Record<AvatarShape, string> = {
  disc: 'Single disc',
  stack: 'Stacked discs',
  four: 'Four in a row',
  column: 'Full column',
  diagonal: 'Diagonal line',
  grid: 'Board grid',
  split: 'Split field',
  ring: 'Ring',
  wave: 'Wave',
  spark: 'Spark',
};

/**
 * The catalogue: every shape in every palette, which is 80 options — enough
 * that a player is unlikely to collide with someone they are playing, without
 * needing anything generative or unbounded.
 */
export const AVATAR_PRESETS: AvatarPreset[] = SHAPES.flatMap((shape, shapeIndex) =>
  PALETTES.map((colours, paletteIndex) => ({
    id: `${shape}-${paletteIndex + 1}`,
    shape,
    colours,
    label: `${SHAPE_LABELS[shape]}, colourway ${paletteIndex + 1}`,
    // Referenced so the flatMap index is not unused in strict builds.
    ...(shapeIndex >= 0 ? {} : {}),
  })),
);

export const AVATAR_PRESETS_BY_ID: Record<string, AvatarPreset> = Object.fromEntries(
  AVATAR_PRESETS.map((preset) => [preset.id, preset]),
);

/** Avatar URLs of the form `avatar:<id>` reference a preset rather than a file. */
export const PRESET_PREFIX = 'avatar:';

export function isPresetAvatar(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith(PRESET_PREFIX);
}

export function presetIdFromUrl(url: string): string | null {
  if (!isPresetAvatar(url)) return null;
  return url.slice(PRESET_PREFIX.length);
}

export function presetUrl(id: string): string {
  return `${PRESET_PREFIX}${id}`;
}

/** Validates a preset id sent by a client. */
export function isValidPresetId(id: unknown): id is string {
  return typeof id === 'string' && id in AVATAR_PRESETS_BY_ID;
}

/**
 * The avatar as an SVG string.
 *
 * Generated rather than stored as files: 80 SVGs is 80 HTTP requests and 80
 * things to deploy, and each one is a dozen shapes. The client renders this
 * inline; the server can use the same function to produce an image for
 * anywhere that needs a real URL.
 */
export function renderAvatar(preset: AvatarPreset, size = 96): string {
  const [bg, a, b] = preset.colours;
  const body = shapeMarkup(preset.shape, a, b);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}"`,
    ` role="img" aria-label="${preset.label}">`,
    `<rect width="48" height="48" fill="${bg}"/>`,
    body,
    '</svg>',
  ].join('');
}

function shapeMarkup(shape: AvatarShape, a: string, b: string): string {
  switch (shape) {
    case 'disc':
      return `<circle cx="24" cy="24" r="13" fill="${a}"/>`;

    case 'stack':
      return (
        `<circle cx="24" cy="32" r="9" fill="${a}"/>` +
        `<circle cx="24" cy="16" r="9" fill="${b}"/>`
      );

    case 'four':
      return [0, 1, 2, 3]
        .map(
          (i) =>
            `<circle cx="${9 + i * 10}" cy="24" r="4.4" fill="${i % 2 === 0 ? a : b}"/>`,
        )
        .join('');

    case 'column':
      return [0, 1, 2]
        .map((i) => `<circle cx="24" cy="${12 + i * 12}" r="5.2" fill="${i === 1 ? b : a}"/>`)
        .join('');

    case 'diagonal':
      return [0, 1, 2, 3]
        .map(
          (i) =>
            `<circle cx="${10 + i * 9}" cy="${38 - i * 9}" r="4.2" fill="${
              i % 2 === 0 ? a : b
            }"/>`,
        )
        .join('');

    case 'grid':
      return [0, 1, 2]
        .flatMap((row) =>
          [0, 1, 2].map(
            (col) =>
              `<circle cx="${13 + col * 11}" cy="${13 + row * 11}" r="3.6" fill="${
                (row + col) % 2 === 0 ? a : b
              }"/>`,
          ),
        )
        .join('');

    case 'split':
      return (
        `<path d="M0 0 H48 V48 H0 Z" fill="${a}"/>` +
        `<path d="M48 0 V48 H0 Z" fill="${b}"/>`
      );

    case 'ring':
      return (
        `<circle cx="24" cy="24" r="14" fill="none" stroke="${a}" stroke-width="6"/>` +
        `<circle cx="24" cy="24" r="4" fill="${b}"/>`
      );

    case 'wave':
      return (
        `<path d="M2 30 Q 12 18 24 30 T 46 30" fill="none" stroke="${a}" stroke-width="5" stroke-linecap="round"/>` +
        `<path d="M2 18 Q 12 6 24 18 T 46 18" fill="none" stroke="${b}" stroke-width="5" stroke-linecap="round"/>`
      );

    case 'spark':
      return (
        `<path d="M24 6 L28 20 L42 24 L28 28 L24 42 L20 28 L6 24 L20 20 Z" fill="${a}"/>` +
        `<circle cx="24" cy="24" r="3.4" fill="${b}"/>`
      );

    default:
      return `<circle cx="24" cy="24" r="13" fill="${a}"/>`;
  }
}

/** The SVG as a data URI, for use directly in an `img` src. */
export function avatarDataUri(preset: AvatarPreset, size = 96): string {
  const svg = renderAvatar(preset, size);
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * A stable default for an account that has never chosen one, derived from the
 * user id so the same person always gets the same avatar.
 */
export function defaultPresetFor(seed: string): AvatarPreset {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_PRESETS[hash % AVATAR_PRESETS.length]!;
}
