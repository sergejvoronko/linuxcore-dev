import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';

import cloudflare from "@astrojs/cloudflare";

export default defineConfig({
  site: 'https://linuxcore.dev',
  integrations: [tailwind(), mdx()],

  markdown: {
    shikiConfig: { theme: 'github-dark', wrap: true },
  },

  vite: {
    optimizeDeps: { exclude: ['astro:content'] },
  },

  output: "hybrid",
  adapter: cloudflare()
});