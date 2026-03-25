/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        // Brand palette — matches the homepage design
        green:  {
          DEFAULT: '#00ff88',
          dim:     '#00cc66',
          dark:    '#003322',
          faint:   'rgba(0,255,136,0.06)',
        },
        cyan:   '#00e5ff',
        amber:  '#ffb300',
        red:    '#ff4466',
        purple: '#b388ff',
        bg: {
          DEFAULT: '#060c06',
          2:       '#080e08',
          3:       '#0c160c',
        },
        text: {
          DEFAULT: '#c8e6c8',
          dim:     '#5a7a5a',
          bright:  '#e8f5e8',
        },
        border: '#1a2e1a',
      },
      fontFamily: {
        mono:  ['"IBM Plex Mono"', 'monospace'],
        sans:  ['Syne', 'sans-serif'],
      },
      typography: (theme) => ({
        invert: {
          css: {
            '--tw-prose-body':         theme('colors.text.DEFAULT'),
            '--tw-prose-headings':     theme('colors.text.bright'),
            '--tw-prose-code':         theme('colors.cyan'),
            '--tw-prose-links':        theme('colors.green.DEFAULT'),
            '--tw-prose-bold':         theme('colors.text.bright'),
            '--tw-prose-counters':     theme('colors.text.dim'),
            '--tw-prose-bullets':      theme('colors.green.dim'),
            '--tw-prose-hr':           theme('colors.border'),
            '--tw-prose-quotes':       theme('colors.text.dim'),
            '--tw-prose-quote-borders':theme('colors.green.dark'),
            '--tw-prose-captions':     theme('colors.text.dim'),
            '--tw-prose-pre-code':     theme('colors.text.DEFAULT'),
            '--tw-prose-pre-bg':       theme('colors.bg.2'),
            '--tw-prose-th-borders':   theme('colors.border'),
            '--tw-prose-td-borders':   theme('colors.border'),
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
