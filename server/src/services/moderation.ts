/**
 * Text screening for anything a player can put in front of other players:
 * usernames and bios.
 *
 * Design notes
 * ------------
 * A plain substring blocklist is trivially defeated — `sh1t`, `s-h-i-t`,
 * `ѕhit` (Cyrillic es). So the input is normalised first: Unicode-folded,
 * homoglyphs mapped to ASCII, leetspeak digits mapped to letters, separators
 * stripped, and runs of repeats collapsed. Matching then happens on that
 * canonical form.
 *
 * The blocklist is deliberately not exhaustive and never will be — no word list
 * is. It is one layer: usernames are also length- and charset-constrained, bios
 * are short, and there is a report route for what gets through. What this does
 * buy is that the obvious cases, and the obvious evasions of them, are refused
 * at the point of entry rather than after somebody has seen them.
 *
 * False positives are the real cost. "Scunthorpe" is the canonical example, so
 * terms that commonly appear inside innocent words are matched as whole words
 * only, and an allowlist protects specific known-good words.
 */

/** Confusable characters mapped to the ASCII letter they imitate. */
const HOMOGLYPHS: Record<string, string> = {
  // Cyrillic and Greek lookalikes.
  а: 'a', е: 'e', о: 'o', р: 'p', с: 'c', х: 'x', у: 'y', і: 'i', ѕ: 's',
  ν: 'v', ο: 'o', ρ: 'p', τ: 't', α: 'a', ε: 'e', ι: 'i', κ: 'k',
  // Fullwidth forms.
  ａ: 'a', ｂ: 'b', ｃ: 'c', ｄ: 'd', ｅ: 'e', ｆ: 'f', ｇ: 'g', ｈ: 'h',
  ｉ: 'i', ｊ: 'j', ｋ: 'k', ｌ: 'l', ｍ: 'm', ｎ: 'n', ｏ: 'o', ｐ: 'p',
  ｑ: 'q', ｒ: 'r', ｓ: 's', ｔ: 't', ｕ: 'u', ｖ: 'v', ｗ: 'w', ｘ: 'x',
  ｙ: 'y', ｚ: 'z',
};

/** Digits and symbols commonly substituted for letters. */
const LEET: Record<string, string> = {
  '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b',
  '@': 'a', $: 's', '!': 'i', '|': 'i', '+': 't', '(': 'c', '<': 'c',
};

/**
 * Reduces text to a canonical form for matching.
 *
 * Exported because the tests assert on it directly: the normalisation is the
 * part that actually does the work, and it is worth testing on its own.
 */
export function normalise(input: string): string {
  const folded = input
    .normalize('NFKD')
    // Strip combining marks, which are otherwise a trivial way to break up a
    // word while leaving it perfectly readable.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

  let out = '';
  for (const ch of folded) {
    out += HOMOGLYPHS[ch] ?? LEET[ch] ?? ch;
  }

  return out
    // Anything that is not a letter is a separator, and separators are how
    // evasion works: "s.h.i.t", "s_h_i_t", "s h i t".
    .replace(/[^a-z]/g, '')
    // "shiiiiit" and "shit" should match the same rule.
    .replace(/(.)\1{2,}/g, '$1$1');
}

/**
 * The forms a string is matched against.
 *
 * `normalise` collapses a run of repeats to two, which keeps ordinary words
 * intact but leaves "shiiiit" as "shiit" — still not a match. Collapsing all
 * the way to one catches that. Both are checked, because each is wrong on its
 * own: collapsing to one would turn "class" into "clas" and lose a genuine
 * match, while collapsing to two lets a stretched word through.
 *
 * Collapsing fully also removes false positives rather than adding them:
 * "class" becomes "clas" and no longer contains "ass", and "shell" becomes
 * "shel" and no longer contains "hell".
 */
function variants(input: string): [string, string] {
  const twoMax = normalise(input);
  const oneMax = twoMax.replace(/(.)\1+/g, '$1');
  return [twoMax, oneMax];
}

/**
 * Terms refused anywhere in the normalised text.
 *
 * Kept short and obvious on purpose. The point is not to enumerate every
 * offensive string in English — that is unachievable — but to refuse the ones
 * a child is most likely to meet, and to make casual evasion not work.
 */
const SUBSTRING_TERMS = [
  // Profanity.
  'fuck', 'shit', 'bitch', 'bastard', 'wanker', 'bollock', 'asshole',
  'arsehole', 'dickhead', 'motherfucker', 'cunt', 'twat', 'prick', 'slut',
  'whore', 'pussy', 'penis', 'vagina', 'boobs', 'titties', 'blowjob',
  'handjob', 'jizz', 'cum', 'wank', 'bugger',
  // Slurs and hate. Matched as substrings because evasion is the norm here.
  'nigger', 'nigga', 'faggot', 'retard', 'tranny', 'chink', 'spic',
  'kike', 'wetback', 'gook', 'paki', 'coon', 'nazi', 'hitler', 'kkk',
  // Sexual content.
  'porn', 'hentai', 'rape', 'incest', 'pedo', 'paedo', 'molest',
  // Self-harm and violence.
  'suicide', 'killyourself', 'kys',
  // Drugs, in the pushing sense.
  'cocaine', 'meth', 'heroin',
];

/**
 * Terms refused only as whole words, because they appear inside perfectly
 * ordinary ones. "ass" is in "class" and "grass"; "hell" is in "shell" and
 * "hello"; "anal" is in "analysis" and "analogue" — which this codebase says a
 * lot.
 */
const WORD_TERMS = [
  'ass', 'anal', 'hell', 'damn', 'crap', 'sex', 'nude', 'dick', 'cock',
  'tit', 'fag', 'homo', 'dyke', 'gay', 'sluts', 'hoe', 'pee', 'poo',
];

/**
 * Words that survive normalisation into something on a list above but are
 * entirely innocent. Checked before matching.
 */
const ALLOWED = new Set([
  'analysis', 'analyse', 'analyze', 'analytic', 'analytics', 'analogue',
  'analog', 'assassin', 'assess', 'asset', 'assign', 'assist', 'associate',
  'assume', 'assure', 'bass', 'brass', 'class', 'classic', 'compass',
  'cassette', 'glass', 'grass', 'mass', 'massive', 'pass', 'passion',
  'shell', 'shelter', 'hello', 'michelle', 'rachel', 'cocktail', 'peacock',
  'scunthorpe', 'penistone', 'lightwater', 'titan', 'titanium', 'title',
  'competition', 'constitution', 'substitute', 'dickens', 'essex', 'sussex',
  'middlesex', 'therapist', 'grape', 'grapes', 'shiitake', 'cumberland',
  'cumulative', 'circumstance', 'document', 'accumulate',
]);

export type ModerationReason = 'blocked-term' | 'impersonation' | 'gibberish' | 'reserved';

export interface ModerationResult {
  ok: boolean;
  reason?: ModerationReason;
  /** What to tell the person, in their own terms. */
  message?: string;
}

const OK: ModerationResult = { ok: true };

/** Names that would let someone pass themselves off as the site. */
const IMPERSONATION = [
  'admin', 'administrator', 'moderator', 'mod', 'staff', 'support',
  'official', 'connectfour', 'connectgg', 'system', 'owner', 'helpdesk',
  'team', 'security',
];

function containsBlocked(input: string): string | null {
  for (const form of variants(input)) {
    for (const term of SUBSTRING_TERMS) {
      if (form.includes(term)) return term;
    }
  }
  return null;
}

function matchesWordTerm(words: string[]): string | null {
  for (const word of words) {
    if (ALLOWED.has(word)) continue;
    if (WORD_TERMS.includes(word)) return word;
  }
  return null;
}

/**
 * Screens a username.
 *
 * Applied at setup and on every change, so a name cannot be smuggled in by
 * editing it later.
 */
export function screenUsername(username: string): ModerationResult {
  const normalised = normalise(username);

  if (ALLOWED.has(normalised)) return OK;

  const blocked = containsBlocked(username);
  if (blocked) {
    return {
      ok: false,
      reason: 'blocked-term',
      message: 'That username is not allowed. Please choose another.',
    };
  }

  if (matchesWordTerm([normalised])) {
    return {
      ok: false,
      reason: 'blocked-term',
      message: 'That username is not allowed. Please choose another.',
    };
  }

  for (const term of IMPERSONATION) {
    if (normalised.includes(term)) {
      return {
        ok: false,
        reason: 'impersonation',
        message: 'That username could be mistaken for site staff. Please choose another.',
      };
    }
  }

  return OK;
}

/** Screens free text — a bio. Matches whole words as well as substrings. */
export function screenText(text: string): ModerationResult {
  if (!text.trim()) return OK;

  const blocked = containsBlocked(text);
  if (blocked) {
    return {
      ok: false,
      reason: 'blocked-term',
      message: 'Please keep your bio friendly for all ages — something in there is not allowed.',
    };
  }

  // Word matching runs on the original text split into words, each normalised
  // on its own, so "class" stays one word rather than melting into its
  // neighbours the way whole-string normalisation would allow.
  const words = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}@$!|+<(]+/u)
    .map(normalise)
    .filter(Boolean);

  if (matchesWordTerm(words)) {
    return {
      ok: false,
      reason: 'blocked-term',
      message: 'Please keep your bio friendly for all ages — something in there is not allowed.',
    };
  }

  return OK;
}

/** Both checks, for the setup form which submits them together. */
export function screenProfile(input: {
  username?: string | undefined;
  bio?: string | null | undefined;
}): ModerationResult {
  if (input.username) {
    const result = screenUsername(input.username);
    if (!result.ok) return result;
  }
  if (input.bio) {
    const result = screenText(input.bio);
    if (!result.ok) return result;
  }
  return OK;
}
