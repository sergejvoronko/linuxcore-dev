import type { APIRoute } from 'astro';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export const OPTIONS: APIRoute = () =>
  new Response(null, { status: 204, headers: CORS });

export const POST: APIRoute = async ({ request, locals }) => {
  const env = (locals as any).runtime?.env ?? {};

  let body: { name?: string; email?: string; subject?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const { name, email, subject, message } = body;

  if (!name || !email || !subject || !message) {
    return new Response(JSON.stringify({ error: 'All fields are required.' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key':      env.BREVO_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender:      { name: 'linuxcore.dev', email: env.CONTACT_FROM },
      to:          [{ email: env.CONTACT_TO_EMAIL }],
      replyTo:     { email },
      subject:     `[linuxcore.dev] ${subject}`,
      htmlContent: `
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
    console.error('Brevo error:', await res.text());
    return new Response(JSON.stringify({ error: 'Failed to send email.' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
};
