/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // The two disc colours, used everywhere a player is identified.
        red: {
          disc: '#ef4444',
          discDark: '#b91c1c',
        },
        yellow: {
          disc: '#facc15',
          discDark: '#ca8a04',
        },
        board: {
          DEFAULT: '#1e3a8a',
          dark: '#172554',
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
