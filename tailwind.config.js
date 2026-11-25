/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        dark: { 900: '#0a0e1a', 800: '#0f172a', 700: '#111827', 600: '#1a2236', 500: '#1e293b' },
        brand: { DEFAULT: '#f59e0b', dark: '#d97706', light: '#fbbf24' },
        accent: { cyan: '#06b6d4', green: '#10b981', red: '#ef4444', purple: '#8b5cf6', pink: '#ec4899' },
        choice: { red: '#ef4444', blue: '#3b82f6', green: '#10b981', yellow: '#f59e0b', purple: '#8b5cf6', pink: '#ec4899' },
      },
      fontFamily: {
        display: ['Outfit', 'sans-serif'],
        mono: ['Space Mono', 'monospace'],
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'timer-pulse': 'timerPulse 0.5s ease-in-out infinite',
      },
      keyframes: {
        float: { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
        glow: { '0%, 100%': { boxShadow: '0 0 20px rgba(245,158,11,0.3)' }, '50%': { boxShadow: '0 0 40px rgba(245,158,11,0.6)' } },
        timerPulse: { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.5 } },
      },
    },
  },
  plugins: [],
}
