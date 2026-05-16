import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import cloudflare from '@astrojs/cloudflare';

import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://linuxcore.dev',
  output: 'hybrid',
  adapter: cloudflare(),
  integrations: [
    tailwind(),
    mdx(),
    sitemap({
      filter: (page) =>
        !page.includes('/go/') &&
        !page.includes('/thanks/') &&
        !page.includes('/shop/success/') &&
        !page.includes('/gpsr/') &&
        !page.match(/\/blog\/[^/]+\//),
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
  vite: {
    optimizeDeps: {
      exclude: ['astro:content'],
    },
  },
});