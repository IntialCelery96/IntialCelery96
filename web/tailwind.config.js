/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /**
       * Semantic colours only — every one resolves to a CSS variable the theme
       * layer sets, so `bg-surface/60` and friends still compose alpha while
       * following whichever theme is active. See src/theme/themes.ts.
       */
      colors: {
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--c-surface) / <alpha-value>)',
          2: 'rgb(var(--c-surface-2) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--c-line) / <alpha-value>)',
          2: 'rgb(var(--c-line-2) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',
          2: 'rgb(var(--c-ink-2) / <alpha-value>)',
          3: 'rgb(var(--c-ink-3) / <alpha-value>)',
          4: 'rgb(var(--c-ink-4) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          2: 'rgb(var(--c-accent-2) / <alpha-value>)',
          text: 'rgb(var(--c-accent-text) / <alpha-value>)',
        },
        'on-accent': 'rgb(var(--c-on-accent) / <alpha-value>)',

        good: 'rgb(var(--c-good) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
        caution: 'rgb(var(--c-caution) / <alpha-value>)',
        bad: 'rgb(var(--c-bad) / <alpha-value>)',
        special: 'rgb(var(--c-special) / <alpha-value>)',

        board: {
          DEFAULT: 'rgb(var(--c-board) / <alpha-value>)',
          deep: 'rgb(var(--c-board-deep) / <alpha-value>)',
        },
        slot: 'rgb(var(--c-slot) / <alpha-value>)',

        p1: {
          DEFAULT: 'rgb(var(--c-p1) / <alpha-value>)',
          deep: 'rgb(var(--c-p1-deep) / <alpha-value>)',
        },
        p2: {
          DEFAULT: 'rgb(var(--c-p2) / <alpha-value>)',
          deep: 'rgb(var(--c-p2-deep) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      keyframes: {
        drop: {
          '0%': { transform: 'translateY(-420%)', opacity: '0.4' },
          '70%': { transform: 'translateY(0)' },
          // A small bounce on landing, so a move reads as a physical action.
          '85%': { transform: 'translateY(-8%)' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseWin: {
          '0%, 100%': { transform: 'scale(1)', filter: 'brightness(1)' },
          '50%': { transform: 'scale(1.08)', filter: 'brightness(1.35)' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        drop: 'drop 420ms cubic-bezier(0.34, 1.2, 0.64, 1) both',
        pulseWin: 'pulseWin 1.1s ease-in-out infinite',
        fadeUp: 'fadeUp 220ms ease-out both',
      },
    },
  },
  plugins: [],
};
