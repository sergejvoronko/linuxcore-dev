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
    destination: 'https://amzn.to/beelink-mini-s12',
    label:       'Beelink Mini S12 Pro',
  },
  {
    slug:        'zimaboard',
    destination: 'https://amzn.to/zimaboard',
    label:       'ZimaBoard Single Board Server',
  },
  {
    slug:        'synology-ds923',
    destination: 'https://amzn.to/synology-ds923',
    label:       'Synology DS923+ NAS',
  },
  {
    slug:        'tp-link-switch',
    destination: 'https://amzn.to/tp-link-switch',
    label:       'TP-Link 8-Port Managed Switch',
  },
  {
    slug:        'crucial-ddr5',
    destination: 'https://amzn.to/crucial-ddr5',
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
    destination: 'https://www.hetzner.com/cloud',
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
    destination: 'https://YOUR_USERNAME.gumroad.com/l/ansible-homelab-bundle',
    label:       'Ansible Homelab Bundle (Gumroad)',
  },
];
