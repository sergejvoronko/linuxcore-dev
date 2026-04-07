// functions/api/contact.ts
// Cloudflare Pages Function — handles POST /api/contact
// Sends email via Resend API
//
// Env vars required (set in Cloudflare Pages → Settings → Environment Variables):
//   RESEND_API_KEY    — from resend.com dashboard
//   CONTACT_TO_EMAIL  — where messages land (your inbox)
//   CONTACT_FROM      — verified sender, e.g. contact@linuxcore.dev

import type { EventContext } from '@cloudflare/workers-types';

interface Env {
  RESEND_API_KEY:   string;
  CONTACT_TO_EMAIL: string;
  CONTACT_FROM:     string;
}

interface Body {
  name:    string;
  email:   string;
  subject: string;
  message: string;
}

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const onRequestOptions = () =>
  new Response(null, { status: 204, headers: CORS });

export async function onRequestPost({
  request,
  env,
}: EventContext<Env, string, unknown>): Promise<Response> {

  const json: Body = await request.json();
  const { name, email, subject, message } = json;

  if (!name || !email || !subject || !message) {
    return new Response(JSON.stringify({ error: 'All fields are required.' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      from:     `linuxcore.dev contact form <${env.CONTACT_FROM}>`,
      to:       [env.CONTACT_TO_EMAIL],
      reply_to: email,
      subject:  `[linuxcore.dev] ${subject}`,
      html: `
        <div style="font-family:monospace;background:#18120a;color:#e8dcc8;padding:32px;border-radius:8px;max-width:560px">
          <div style="color:#f0a500;font-size:11px;letter-spacing:0.1em;margin-bottom:16px">[CONTACT FORM]</div>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
            <tr><td style="padding:6px 0;color:rgba(232,220,200,0.5);width:80px">From</td><td style="padding:6px 0;color:#e8dcc8">${name}</td></tr>
            <tr><td style="padding:6px 0;color:rgba(232,220,200,0.5)">Email</td><td style="padding:6px 0"><a href="mailto:${email}" style="color:#f0a500">${email}</a></td></tr>
            <tr><td style="padding:6px 0;color:rgba(232,220,200,0.5)">Subject</td><td style="padding:6px 0;color:#e8dcc8">${subject}</td></tr>
          </table>
          <div style="background:#1e1710;border:1px solid rgba(240,165,0,0.15);border-left:3px solid #f0a500;border-radius:4px;padding:20px">
            <div style="font-size:10px;letter-spacing:0.1em;color:#f0a500;margin-bottom:12px">MESSAGE</div>
            <pre style="white-space:pre-wrap;margin:0;color:#e8dcc8;font-family:monospace;line-height:1.7;font-size:14px">${message}</pre>
          </div>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('Resend error:', err);
    return new Response(JSON.stringify({ error: 'Failed to send email.' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
