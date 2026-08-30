import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { DEFAULT_THEME, THEMES, THEMES_BY_ID, applyTheme, isThemeId, type Theme } from './themes';
import {
  BOARD_STYLES,
  BOARD_STYLES_BY_ID,
  DISC_SETS,
  DISC_SETS_BY_ID,
  applyDiscSet,
  isBoardStyleId,
  isDiscSetId,
  type BoardStyle,
  type DiscSet,
} from './appearance';

const STORAGE_KEY = 'c4-theme';
const BOARD_KEY = 'c4-board-style';
const DISCS_KEY = 'c4-disc-set';

interface ThemeContextValue {
  theme: Theme;
  themes: Theme[];
  setTheme: (id: string) => void;

  /** How the board frame and slots are drawn. Cosmetic only. */
  boardStyle: BoardStyle;
  boardStyles: BoardStyle[];
  setBoardStyle: (id: string) => void;

  /** Disc colours, either following the theme or overriding it. */
  discSet: DiscSet;
  discSets: DiscSet[];
  setDiscSet: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/** Reads a stored preference, falling back when it is missing or unknown. */
function readStored(key: string, valid: (value: unknown) => boolean, fallback: string): string {
  try {
    const stored = localStorage.getItem(key);
    return valid(stored) ? stored! : fallback;
  } catch {
    // Private browsing, or storage disabled. The defaults are fine.
    return fallback;
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not being able to remember a choice is not a reason to refuse it.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState(() => readStored(STORAGE_KEY, isThemeId, DEFAULT_THEME));
  const [boardId, setBoardId] = useState(() => readStored(BOARD_KEY, isBoardStyleId, 'theme'));
  const [discId, setDiscId] = useState(() => readStored(DISCS_KEY, isDiscSetId, 'theme'));

  const theme = THEMES_BY_ID[id] ?? THEMES_BY_ID[DEFAULT_THEME]!;
  const boardStyle = BOARD_STYLES_BY_ID[boardId] ?? BOARD_STYLES_BY_ID.theme!;
  const discSet = DISC_SETS_BY_ID[discId] ?? DISC_SETS_BY_ID.theme!;

  useEffect(() => {
    applyTheme(theme, document.documentElement);
    // Discs are re-applied after the theme, because the theme writes the same
    // variables and would otherwise undo a custom disc set on every change.
    applyDiscSet(discSet, document.documentElement, {
      p1: theme.tokens.p1,
      'p1-deep': theme.tokens['p1-deep'],
      p2: theme.tokens.p2,
      'p2-deep': theme.tokens['p2-deep'],
    });
  }, [theme, discSet]);

  const setTheme = useCallback((next: string) => {
    if (!isThemeId(next)) return;
    setId(next);
    store(STORAGE_KEY, next);
  }, []);

  const setBoardStyle = useCallback((next: string) => {
    if (!isBoardStyleId(next)) return;
    setBoardId(next);
    store(BOARD_KEY, next);
  }, []);

  const setDiscSet = useCallback((next: string) => {
    if (!isDiscSetId(next)) return;
    setDiscId(next);
    store(DISCS_KEY, next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      themes: THEMES,
      setTheme,
      boardStyle,
      boardStyles: BOARD_STYLES,
      setBoardStyle,
      discSet,
      discSets: DISC_SETS,
      setDiscSet,
    }),
    [theme, setTheme, boardStyle, setBoardStyle, discSet, setDiscSet],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider');
  return context;
}
