import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './store/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        accent: 'hsl(var(--accent))',
        'accent-foreground': 'hsl(var(--accent-foreground))',
        border: 'var(--border)',
      },
      borderRadius: {
        xl: '1rem',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(56, 189, 248, 0.25), 0 8px 24px rgba(14, 165, 233, 0.16)',
      },
      backgroundImage: {
        'mesh-grid':
          'radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.16), transparent 45%), radial-gradient(circle at 80% 0%, rgba(14, 165, 233, 0.12), transparent 40%), radial-gradient(circle at 50% 85%, rgba(59, 130, 246, 0.08), transparent 50%)',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.45s ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;


