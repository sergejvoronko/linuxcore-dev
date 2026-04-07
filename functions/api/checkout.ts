// functions/api/checkout.ts
// Cloudflare Pages Function — handles POST /api/checkout
// Creates a Stripe Checkout session for a Printify product variant.
//
// Env vars required (Cloudflare Pages → Settings → Environment Variables):
//   STRIPE_SECRET_KEY  — from Stripe dashboard → Developers → API Keys
//   SITE_URL           — e.g. https://linuxcore.dev

import type { EventContext } from '@cloudflare/workers-types';

interface Env {
  STRIPE_SECRET_KEY: string;
  SITE_URL:          string;
}

interface Body {
  productId: string;
  variantId: number;
  quantity:  number;
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

  const { productId, variantId, quantity }: Body = await request.json();

  if (!productId || !variantId || !quantity) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Build Stripe Checkout session via Stripe API
  const params = new URLSearchParams({
    'line_items[0][price_data][currency]':                'eur',
    'line_items[0][price_data][product_data][name]':      `Product ${productId}`,
    'line_items[0][price_data][product_data][metadata][printify_product_id]': productId,
    'line_items[0][price_data][product_data][metadata][printify_variant_id]': String(variantId),
    'line_items[0][price_data][unit_amount]':             '2900', // fallback; ideally pass real price
    'line_items[0][quantity]':                            String(quantity),
    'mode':                                               'payment',
    'success_url':                                        `${env.SITE_URL}/shop/success`,
    'cancel_url':                                         `${env.SITE_URL}/shop/product/${productId}`,
    'metadata[printify_product_id]':                      productId,
    'metadata[printify_variant_id]':                      String(variantId),
  });

  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!stripeRes.ok) {
    const err = await stripeRes.json() as { error?: { message?: string } };
    return new Response(
      JSON.stringify({ error: err?.error?.message ?? 'Stripe error' }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }

  const session = await stripeRes.json() as { url: string };

  return new Response(JSON.stringify({ url: session.url }), {
    status: 200, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
