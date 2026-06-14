import type { APIRoute } from 'astro';
import { env } from 'cloudflare:workers';

export const prerender = false;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (data: unknown, status: number) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

export const OPTIONS: APIRoute = () =>
  new Response(null, { status: 204, headers: CORS });

export const POST: APIRoute = async ({ request, locals }) => {
  try {

    let email: string | undefined;
    try {
      const body = await request.json() as { email?: string };
      email = body.email;
    } catch {
      return json({ error: 'Invalid request body' }, 400);
    }

    if (!email?.trim() || !email.includes('@')) {
      return json({ error: 'Valid email address required' }, 400);
    }

    if (!env.MAILERLITE_API_KEY) {
      return json({ error: 'Newsletter not configured' }, 503);
    }

    const payload: Record<string, unknown> = { email, status: 'active' };
    if (env.MAILERLITE_GROUP_ID) payload.groups = [env.MAILERLITE_GROUP_ID];

    const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.MAILERLITE_API_KEY}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.status === 200 || res.status === 201) return json({ ok: true }, 200);
    if (res.status === 409) return json({ ok: true, note: 'already_subscribed' }, 200);

    let errMsg = 'Subscription failed';
    try {
      const errBody = await res.json() as any;
      errMsg = errBody?.message ?? errMsg;
    } catch {}

    return json({ error: errMsg }, 500);
  } catch (e: any) {
    console.error('Subscribe error:', e);
    return json({ error: 'Server error' }, 500);
  }
};
