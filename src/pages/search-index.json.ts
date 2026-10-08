// Small static index for the header search: built once at deploy time,
// fetched by the browser only when someone opens the search box.
import { getCollection } from 'astro:content';

export const prerender = true;

export async function GET() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  const items = posts
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .map(({ id, data }) => ({
      t: data.title,
      d: data.description,
      s: data.section,
      g: data.tags ?? [],
      u: `/${data.section}/${id}/`,
    }));
  return new Response(JSON.stringify(items), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
