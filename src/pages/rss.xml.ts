// src/pages/rss.xml.ts
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const now = new Date();
  const posts = await getCollection('blog', ({ data }) => !data.draft && data.pubDate <= now);
  const sorted = posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf()
  );

  return rss({
    title: 'linuxcore.dev',
    description: 'Linux homelab automation, self-hosted AI, monitoring, and security.',
    site: context.site!.toString(),
    items: sorted.map(post => {
      const section = post.data.section;
      const link = section === 'homelab' ? `/homelab/${post.id}`
                 : section === 'astro'   ? `/astro/${post.id}`
                 : `/blog/${post.id}`;
      return {
        title:       post.data.title,
        description: post.data.description,
        pubDate:     post.data.pubDate,
        link,
        categories:  post.data.tags,
      };
    }),
    customData: '<language>en-gb</language>',
  });
}
