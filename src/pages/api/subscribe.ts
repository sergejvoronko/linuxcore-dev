import type { APIRoute } from 'astro';

export const prerender = false;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const OPTIONS: APIRoute = () =>
  new Response(null, { status: 204, headers: CORS });

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime?.env ?? {};
  const { email } = await request.json() as { email?: string };

  if (!email?.trim() || !email.includes('@')) {
    return new Response(
      JSON.stringify({ error: 'Valid email address required' }),
      { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  if (!env.MAILERLITE_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Newsletter not configured' }),
      { status: 503, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  const body: Record<string, unknown> = { email, status: 'active' };
  if (env.MAILERLITE_GROUP_ID) body.groups = [env.MAILERLITE_GROUP_ID];

  const res = await fetch('https://connect.mailerlite.com/api/subscribers', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.MAILERLITE_API_KEY}`,
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    },
    body: JSON.stringify(body),
  });

  if (res.status === 200 || res.status === 201) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
  if (res.status === 409) {
    return new Response(JSON.stringify({ ok: true, note: 'already_subscribed' }), {
      status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const error = await res.json() as any;
  return new Response(
    JSON.stringify({ error: error?.message ?? 'Subscription failed' }),
    { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
  );
};
