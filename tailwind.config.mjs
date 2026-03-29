import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        green:  { DEFAULT: '#00ff88', dim: '#00cc66', dark: '#003322', faint: 'rgba(0,255,136,0.06)' },
        cyan:   '#00e5ff',
        amber:  '#ffb300',
        red:    '#ff4466',
        purple: '#b388ff',
        bg:     { DEFAULT: '#060c06', 2: '#080e08', 3: '#0c160c' },
        text:   { DEFAULT: '#c8e6c8', dim: '#5a7a5a', bright: '#e8f5e8' },
        border: '#1a2e1a',
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'monospace'],
        sans: ['Syne', 'sans-serif'],
      },
    },
  },
  plugins: [typography],
};
