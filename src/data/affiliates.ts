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

  // ── Hardware (scaffolded — destinations are tagged Amazon SEARCH links so
  //    they earn immediately; swap each to a specific /dp/<ASIN> when chosen) ──
  {
    slug:        'beelink-eq12',
    destination: 'https://www.amazon.com/s?k=Beelink+EQ12+Pro+N100&tag=aircom01f20-20',  // TODO ASIN: swap to /dp/<ASIN>/?tag=aircom01f20-20
    label:       'Beelink EQ12 Pro (N100 mini PC)',
  },
  {
    slug:        'minisforum-ms01',
    destination: 'https://www.amazon.com/s?k=Minisforum+MS-01&tag=aircom01f20-20',  // TODO ASIN: swap to /dp/<ASIN>/?tag=aircom01f20-20
    label:       'Minisforum MS-01 Mini Workstation',
  },
  {
    slug:        'synology-ds224',
    destination: 'https://www.amazon.com/s?k=Synology+DS224%2B&tag=aircom01f20-20',  // TODO ASIN: swap to /dp/<ASIN>/?tag=aircom01f20-20
    label:       'Synology DS224+ NAS',
  },
  {
    slug:        'wd-red-plus-4tb',
    destination: 'https://www.amazon.com/s?k=WD+Red+Plus+4TB+NAS+drive&tag=aircom01f20-20',  // TODO ASIN: swap to /dp/<ASIN>/?tag=aircom01f20-20
    label:       'WD Red Plus 4TB NAS HDD',
  },
  {
    slug:        'seagate-ironwolf',
    destination: 'https://www.amazon.com/s?k=Seagate+IronWolf+4TB+NAS&tag=aircom01f20-20',  // TODO ASIN: swap to /dp/<ASIN>/?tag=aircom01f20-20
    label:       'Seagate IronWolf 4TB NAS HDD',
  },
  {
    slug:        'samsung-990-pro',
    destination: 'https://www.amazon.com/s?k=Samsung+990+Pro+NVMe+SSD&tag=aircom01f20-20',  // TODO ASIN: swap to /dp/<ASIN>/?tag=aircom01f20-20
    label:       'Samsung 990 Pro NVMe SSD',
  },
  {
    slug:        'tplink-25gbe-switch',
    destination: 'https://www.amazon.com/s?k=TP-Link+TL-SG3210XHP-M2&tag=aircom01f20-20',  // TODO ASIN: swap to /dp/<ASIN>/?tag=aircom01f20-20
    label:       'TP-Link TL-SG3210XHP-M2 2.5GbE Managed Switch',
  },
  {
    slug:        'usb-25gbe-adapter',
    destination: 'https://www.amazon.com/s?k=2.5GbE+USB+ethernet+adapter&tag=aircom01f20-20',  // TODO ASIN: swap to /dp/<ASIN>/?tag=aircom01f20-20
    label:       '2.5GbE USB Ethernet Adapter',
  },
  {
    slug:        'rtx-3060-12gb',
    destination: 'https://www.amazon.com/s?k=NVIDIA+RTX+3060+12GB&tag=aircom01f20-20',  // TODO ASIN: swap to /dp/<ASIN>/?tag=aircom01f20-20
    label:       'NVIDIA RTX 3060 12GB GPU',
  },
  {
    slug:        'coral-usb-tpu',
    destination: 'https://www.amazon.com/s?k=Google+Coral+USB+Accelerator&tag=aircom01f20-20',  // TODO ASIN: swap to /dp/<ASIN>/?tag=aircom01f20-20
    label:       'Google Coral USB Accelerator (TPU)',
  },
  {
    slug:        'raspberry-pi-5',
    destination: 'https://www.amazon.com/s?k=Raspberry+Pi+5+8GB&tag=aircom01f20-20',  // TODO ASIN: swap to /dp/<ASIN>/?tag=aircom01f20-20
    label:       'Raspberry Pi 5 (8GB)',
  },
  {
    slug:        'samsung-pro-endurance',
    destination: 'https://www.amazon.com/s?k=Samsung+PRO+Endurance+microSD&tag=aircom01f20-20',  // TODO ASIN: swap to /dp/<ASIN>/?tag=aircom01f20-20
    label:       'Samsung PRO Endurance microSD',
  },
  {
    slug:        'cyberpower-ups',
    destination: 'https://www.amazon.com/s?k=CyberPower+UPS&tag=aircom01f20-20',  // TODO ASIN: swap to /dp/<ASIN>/?tag=aircom01f20-20
    label:       'CyberPower UPS (battery backup)',
  },
  {
    slug:        'opnsense-mini-pc',
    destination: 'https://www.amazon.com/s?k=Beelink+EQ14+N100&tag=aircom01f20-20',  // TODO ASIN: swap to /dp/<ASIN>/?tag=aircom01f20-20
    label:       'Beelink EQ14 (OPNsense/firewall mini PC)',
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
