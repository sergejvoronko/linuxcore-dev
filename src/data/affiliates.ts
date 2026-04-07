// src/data/affiliates.ts
// Central registry of all affiliate links.
// Add a new entry here, then link to /go/slug anywhere on the site.
// Cloudflare Pages serves the redirect via src/pages/go/[slug].astro

export interface AffiliateLink {
  slug:        string;   // used in URL: /go/slug
  destination: string;   // real affiliate URL
  label:       string;   // human-readable name (for <title> on redirect page)
}

export const affiliates: AffiliateLink[] = [
  // ── Hardware ────────────────────────────────────────────────────
  {
    slug:        'beelink-mini-s12',
    destination: 'https://www.amazon.com/dp/B0BW8JSQCH/?tag=aircom01f20-20',
    label:       'Beelink Mini S12 Pro',
  },
  {
    slug:        'zimaboard',
    destination: 'https://www.amazon.com/dp/B0FYPBZQ3Z/?tag=aircom01f20-20',
    label:       'ZimaBoard Single Board Server',
  },
  {
    slug:        'synology-ds923',
    destination: 'https://www.amazon.com/dp/B0BM7KDN6R/?tag=aircom01f20-20',
    label:       'Synology DS923+ NAS',
  },
  {
    slug:        'tp-link-switch',
    destination: 'https://www.amazon.com/dp/B00K4DS5KU/?tag=aircom01f20-20',
    label:       'TP-Link 8-Port Managed Switch',
  },
  {
    slug:        'crucial-ddr5',
    destination: 'https://www.amazon.com/dp/B0BLTGP2JX/?tag=aircom01f20-20',
    label:       'Crucial 32GB DDR5 RAM',
  },

  // ── Services ─────────────────────────────────────────────────────
  {
    slug:        'cloudflare',
    destination: 'https://www.cloudflare.com',
    label:       'Cloudflare',
  },
  {
    slug:        'hetzner',
    destination: 'https://hetzner.cloud/?ref=linuxcore',
    label:       'Hetzner Cloud VPS',
  },
  {
    slug:        'backblaze-b2',
    destination: 'https://www.backblaze.com/cloud-storage',
    label:       'Backblaze B2 Cloud Storage',
  },

  // ── Digital Products ──────────────────────────────────────────────
  {
    slug:        'ansible-bundle',
    destination: 'https://linuxcore-dev.gumroad.com/l/ansible-homelab-bundle',
    label:       'Ansible Homelab Bundle (Gumroad)',
  },
];
