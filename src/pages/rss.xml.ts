// src/pages/rss.xml.ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const guides = await getCollection('guides', ({ data }) => !data.draft);
  const sorted  = guides.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());

  return rss({
    title: 'linuxcore.dev',
    description: 'Enterprise Linux & AI automation for the modern homelab.',
    site: context.site!.toString(),
    items: sorted.map(post => ({
      title:       post.data.title,
      pubDate:     post.data.pubDate,
      description: post.data.description,
      link:        `/guides/${post.slug}/`,
      categories:  [post.data.pillar, ...post.data.tags],
    })),
    customData: `<language>en-us</language>`,
  });
}
