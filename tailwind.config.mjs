/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        amber:  '#f0a500',
        cream:  '#e8dcc8',
        brown:  '#18120a',
      },
      fontFamily: {
        mono:    ['Space Mono', 'monospace'],
        sans:    ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
