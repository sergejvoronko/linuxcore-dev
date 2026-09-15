#!/usr/bin/env node
/**
 * Pull this site's published Printify products into the site.
 *
 * The Etsy shop holds several brands, so the sync is restricted to the ids in
 * src/data/merch-ids.json. Filtering on an Etsy tag was the alternative, but
 * tags are capped at 13 and one spent on a brand marker is one not spent on a
 * search term.
 *
 * Only products that actually reached Etsy are written out: a product exists in
 * Printify the moment it is created, but it is not buyable until it has an
 * `external.handle`, and a merch page listing something nobody can buy is worse
 * than a shorter merch page.
 *
 * No mockups are downloaded. The merch cards show the artwork itself on a dark
 * plate, which is both how the design is painted and how it prints; Printify's
 * mockups sit on white and would fight that. The art already lives in
 * public/images/merch/.
 *
 * Run: node scripts/sync-merch.mjs   (needs PRINTIFY_TOKEN)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const SHOP = 28918369;
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'src/data/merch.json');
const IDS = path.join(ROOT, 'src/data/merch-ids.json');
const ENV = '/home/sergej/Downloads/airbrushdoc-assets/.env';

async function token() {
  if (process.env.PRINTIFY_TOKEN) return process.env.PRINTIFY_TOKEN;
  const txt = await readFile(ENV, 'utf8');
  const m = txt.match(/^PRINTIFY_TOKEN=(.*)$/m);
  if (!m) throw new Error('PRINTIFY_TOKEN not found');
  return m[1].trim().replace(/^["']|["']$/g, '');
}

const api = (t, p) =>
  fetch(`https://api.printify.com/v1${p}`, {
    headers: { Authorization: `Bearer ${t}`, 'User-Agent': 'airbrushdoc-sync/1.0' },
  }).then(r => {
    if (!r.ok) throw new Error(`${p} -> HTTP ${r.status}`);
    return r.json();
  });

/** Cheapest enabled variant is what the "from $X" price should quote. */
function fromPrice(p) {
  const on = p.variants.filter(v => v.is_enabled);
  return Math.min(...on.map(v => v.price)) / 100;
}

async function main() {
  const t = await token();
  // 50 is the API maximum; limit=100 is rejected with code 8150
  const { data: products } = await api(t, `/shops/${SHOP}/products.json?limit=50`);

  const mine = new Set(JSON.parse(await readFile(IDS, 'utf8')));
  const live = products.filter(p => mine.has(p.id) && p.external?.handle && p.visible);

  const out = live.map(p => ({
    id: p.id,
    title: p.title.split(',')[0].trim(),   // Etsy titles are keyword strings; the first clause is the name
    fullTitle: p.title,
    url: p.external.handle,
    price: fromPrice(p),
    tags: p.tags.slice(0, 4),
  }));

  out.sort((a, b) => a.title.localeCompare(b.title));
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`${products.length} in shop, ${mine.size} are linuxcore's, ${out.length} live on Etsy -> ${path.relative(ROOT, OUT)}`);
  for (const p of out) console.log(`  $${p.price.toFixed(2)}  ${p.title}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
