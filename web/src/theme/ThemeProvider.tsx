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

const STORAGE_KEY = 'c4-theme';

interface ThemeContextValue {
  theme: Theme;
  themes: Theme[];
  setTheme: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStored(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  } catch {
    // Private browsing, or storage disabled. The default is fine.
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string>(() => readStored());

  const theme = THEMES_BY_ID[id] ?? THEMES_BY_ID[DEFAULT_THEME]!;

  useEffect(() => {
    applyTheme(theme, document.documentElement);
  }, [theme]);

  const setTheme = useCallback((next: string) => {
    if (!isThemeId(next)) return;
    setId(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not being able to remember the choice is not a reason to refuse it.
    }
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, themes: THEMES, setTheme }),
    [theme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider');
  return context;
}
