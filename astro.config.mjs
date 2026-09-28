import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import cloudflare from '@astrojs/cloudflare';

import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';
import rehypeLinks from './src/lib/rehype-links.mjs';

// lastmod for the sitemap. Posts only carry pubDate (or updatedDate), so that is
// the honest value. Git commit dates are not used: Cloudflare's build clones
// shallowly, so every file would report the build date and every deploy would
// claim the whole site changed. Section indexes and the homepage take the date
// of their newest post.
const BLOG = './src/content/blog';
const postDates = new Map();
const sectionLatest = new Map();
for (const f of fs.readdirSync(BLOG)) {
  if (!/\.mdx?$/.test(f)) continue;
  const fm = fs.readFileSync(path.join(BLOG, f), 'utf8').split('---')[1] ?? '';
  if (/^draft:\s*true/m.test(fm)) continue;
  const sec = (fm.match(/^section:\s*"?(\w+)/m) ?? [])[1];
  const d = (fm.match(/^updatedDate:\s*"?([\d-]+)/m) ?? fm.match(/^pubDate:\s*"?([\d-]+)/m) ?? [])[1];
  if (!sec || !d) continue;
  const date = new Date(d);
  postDates.set(`/${sec}/${f.replace(/\.mdx?$/, '')}/`, date);
  if (!sectionLatest.has(sec) || sectionLatest.get(sec) < date) sectionLatest.set(sec, date);
}
const newestPost = [...sectionLatest.values()].sort((a, b) => b - a)[0];

export default defineConfig({
  site: 'https://linuxcore.dev',
  output: 'static',
  trailingSlash: 'always',
  build: {
    inlineStylesheets: 'always',
  },
  adapter: cloudflare({
    platformProxy: { enabled: true },
    // 'compile' = run Sharp at build for prerendered routes, emitting static
    // /_astro images. Avoids the runtime /_image endpoint (this site is fully
    // static, so no on-demand resizing is needed).
    imageService: 'compile',
  }),
  integrations: [
    tailwind(),
    mdx(),
    sitemap({
      filter: (page) =>
        !page.includes('/go/') &&
        !page.includes('/thanks/') &&
        !page.includes('/shop/success/') &&
        !page.includes('/gpsr/'),
      serialize(item) {
        const p = new URL(item.url).pathname;
        const sec = p.match(/^\/(\w+)\/$/);
        const d = postDates.get(p) ?? (sec && sectionLatest.get(sec[1])) ?? (p === '/' ? newestPost : undefined);
        if (d) item.lastmod = d.toISOString();
        return item;
      },
    }),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
    rehypePlugins: [rehypeLinks],
  },
  vite: {
    optimizeDeps: {
      exclude: ['astro:content'],
    },
  },
});