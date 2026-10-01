// src/pages/go/[slug].ts
// Pretty affiliate redirect URLs: /go/beelink-mini-s12 → real affiliate URL
// Add new links in src/data/affiliates.ts — no code changes needed here.
//
// Runs in the Worker (not prerendered) so each click can be counted: one
// Analytics Engine point per click, same blob layout as airbrushdoc's /go/
// (slug, source path, human|bot, country, mobile|desktop).

import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';
import { affiliates } from '../../data/affiliates';

export const prerender = false;

const links = new Map(affiliates.map(link => [link.slug, link.destination]));

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|monitor|curl|wget|python|go-http|okhttp/i;

export const GET: APIRoute = ({ request, params }) => {
  const slug = params.slug ?? '';
  const destination = links.get(slug);
  if (!destination) return new Response(null, { status: 404 });

  // Logging must never block the redirect.
  try {
    const clicks = (env as any).GO_CLICKS;
    if (request.method === 'GET' && clicks) {
      const ua = request.headers.get('user-agent') || '';
      let from = '';
      try {
        const ref = new URL(request.headers.get('referer') || '');
        from = /(^|\.)linuxcore\.dev$|\.workers\.dev$/.test(ref.hostname) ? ref.pathname : `ext:${ref.hostname}`;
      } catch {}
      clicks.writeDataPoint({
        blobs: [slug, from, BOT.test(ua) ? 'bot' : 'human', (request as any).cf?.country || '', /mobi/i.test(ua) ? 'mobile' : 'desktop'],
        doubles: [1],
        indexes: [slug],
      });
    }
  } catch {}

  return new Response(null, {
    status: 302,
    headers: {
      Location: destination,
      'X-Robots-Tag': 'noindex, nofollow',
      'Cache-Control': 'private, no-store',
    },
  });
};
