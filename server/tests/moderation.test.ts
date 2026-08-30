import { describe, expect, it } from 'vitest';
import {
  normalise,
  screenProfile,
  screenText,
  screenUsername,
} from '../src/services/moderation.js';

describe('normalise', () => {
  it('lowercases and strips separators', () => {
    expect(normalise('S.H.I.T')).toBe('shit');
    expect(normalise('s_h_i_t')).toBe('shit');
    expect(normalise('s h i t')).toBe('shit');
    expect(normalise('s-h-i-t')).toBe('shit');
  });

  it('maps leetspeak back to letters', () => {
    expect(normalise('sh1t')).toBe('shit');
    expect(normalise('$h1t')).toBe('shit');
    expect(normalise('a55')).toBe('ass');
    expect(normalise('f4ck')).toBe('fack');
  });

  it('maps confusable characters to ASCII', () => {
    // Cyrillic es and Cyrillic i.
    expect(normalise('ѕhіt')).toBe('shit');
    // Fullwidth.
    expect(normalise('ｓｈｉｔ')).toBe('shit');
  });

  it('strips combining marks', () => {
    expect(normalise('s̱ẖi̱ṯ')).toBe('shit');
  });

  it('collapses long runs of repeats', () => {
    expect(normalise('shiiiiiiit')).toBe('shiit');
    expect(normalise('shiit')).toBe('shiit');
  });

  it('leaves ordinary text recognisable', () => {
    expect(normalise('marguerite')).toBe('marguerite');
    expect(normalise('Player_99')).toBe('player');
  });
});

describe('screenUsername', () => {
  it('accepts ordinary names', () => {
    for (const name of ['marguerite', 'kwok', 'deshawn', 'petra_l', 'callum88', 'ingrid-s']) {
      expect(screenUsername(name).ok).toBe(true);
    }
  });

  it('refuses obvious profanity', () => {
    for (const name of ['shitlord', 'fuckyou', 'bigbitch']) {
      const result = screenUsername(name);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('blocked-term');
    }
  });

  it('refuses profanity dressed up to get past a substring check', () => {
    // Each of these is the same word with a different evasion applied.
    for (const name of ['sh1t', 's_h_i_t', 'ѕhit', 'SHIIIIT', 'f-u-c-k', '$hit', 'ｆｕｃｋ']) {
      expect(screenUsername(name).ok).toBe(false);
    }
  });

  it('refuses slurs', () => {
    for (const name of ['n1gger', 'f4ggot', 'retard']) {
      expect(screenUsername(name).ok).toBe(false);
    }
  });

  it('refuses names that impersonate staff', () => {
    for (const name of ['admin', 'moderator', 'c4-official', 'support-team']) {
      const result = screenUsername(name);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('impersonation');
    }
  });

  it('does not trip over innocent words containing blocked fragments', () => {
    // The Scunthorpe problem: these must all be allowed.
    for (const name of [
      'classic', 'grassy', 'bassline', 'assassin', 'passion', 'shelter',
      'michelle', 'peacock', 'titan', 'analyst', 'cumberland', 'essex',
    ]) {
      expect(screenUsername(name).ok, `${name} should be allowed`).toBe(true);
    }
  });

  it('gives a message that says what to do', () => {
    const result = screenUsername('shitlord');
    expect(result.message).toMatch(/choose another/i);
    // Never repeats the offending term back.
    expect(result.message).not.toMatch(/shit/i);
  });
});

describe('screenText', () => {
  it('accepts an ordinary bio', () => {
    expect(screenText('Rapid regular. Always up for a rematch.').ok).toBe(true);
    expect(screenText('').ok).toBe(true);
    expect(screenText('I mostly play blitz and analyse my losses.').ok).toBe(true);
  });

  it('refuses profanity in a bio', () => {
    expect(screenText('this game is shit').ok).toBe(false);
    expect(screenText('come at me f u c k e r').ok).toBe(false);
  });

  it('refuses a blocked whole word without refusing the words containing it', () => {
    expect(screenText('what an ass').ok).toBe(false);
    expect(screenText('I took a class in chess').ok).toBe(true);
    expect(screenText('analysis is my favourite part').ok).toBe(true);
  });

  it('allows a bio that merely mentions the word analysis', () => {
    // This one matters: the site is full of the word.
    expect(screenText('I like the post-game analysis feature').ok).toBe(true);
  });
});

describe('screenProfile', () => {
  it('checks both fields', () => {
    expect(screenProfile({ username: 'marguerite', bio: 'Centre column or nothing.' }).ok).toBe(true);
    expect(screenProfile({ username: 'shitlord', bio: 'hello' }).ok).toBe(false);
    expect(screenProfile({ username: 'marguerite', bio: 'go f u c k yourself' }).ok).toBe(false);
  });

  it('is fine with missing fields', () => {
    expect(screenProfile({}).ok).toBe(true);
    expect(screenProfile({ username: 'kwok', bio: null }).ok).toBe(true);
  });
});
