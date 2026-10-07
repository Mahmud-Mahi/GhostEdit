import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/renderer/**/*.{tsx,ts,html}', './index.html'],
  theme: {
    extend: {
      colors: {
        ghost: {
          bg: 'rgba(40, 42, 54, 0.96)',
          surface: '#343746',
          accent: '#bd93f9',
          text: '#f8f8f2',
          muted: '#a5a7b4',
          success: '#50fa7b',
          error: '#ff5555',
          warning: '#f1fa8c',
          sidebar: 'rgba(33, 34, 44, 0.96)',
          'row-border': 'rgba(189, 147, 249, 0.16)',
          purple: '#bd93f9',
          cyan: '#8be9fd',
          pink: '#ff79c6',
          orange: '#ffb86c',
          selection: '#44475a',
        },
      },
      keyframes: {
        'content-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'content-in': 'content-in 150ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
