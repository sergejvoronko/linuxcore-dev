import { env as cfEnv } from 'cloudflare:workers';

const BASE = 'https://api.printify.com/v1';

function getToken(): string {
  const token = (cfEnv as any).PRINTIFY_API_TOKEN;
  if (!token) throw new Error('PRINTIFY_API_TOKEN is not set');
  return token;
}

function getShopId(): string {
  const id = (cfEnv as any).PRINTIFY_SHOP_ID;
  if (!id) throw new Error('PRINTIFY_SHOP_ID is not set');
  return id;
}

export async function getProducts(): Promise<any[]> {
  const res = await fetch(`${BASE}/shops/${getShopId()}/products.json?limit=40`, {
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Printify API error ${res.status}`);
  const data = await res.json() as { data: any[] };
  return (data.data ?? []).filter((p: any) => p.visible);
}

export async function getProduct(id: string): Promise<any> {
  const res = await fetch(`${BASE}/shops/${getShopId()}/products/${id}.json`, {
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`Printify product not found: ${id}`);
  return res.json();
}

export function getDefaultImage(product: any): string {
  return product?.images?.[0]?.src ?? '/images/placeholder-product.png';
}

export function getBasePrice(product: any): number {
  const prices = (product?.variants ?? [])
    .filter((v: any) => v.is_enabled)
    .map((v: any) => v.price ?? 0);
  return prices.length ? Math.min(...prices) : 0;
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency', currency: 'EUR',
  }).format(cents / 100);
}
