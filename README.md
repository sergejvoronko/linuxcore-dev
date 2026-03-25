# linuxcore.dev — Astro Site

Enterprise Linux & AI automation for the modern homelab.  
Built with **Astro 4**, **Tailwind CSS**, **MDX**, and deployable to **Cloudflare Pages** in under 5 minutes.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start dev server (hot-reload)
npm run dev
# → Open http://localhost:4321

# 3. Build for production
npm run build

# 4. Preview production build locally
npm run preview
```

> **Node.js 18+** required.

---

## Project Structure

```
linuxcore-dev/
├── public/                    # Static assets (served as-is)
│   ├── favicon.svg
│   ├── robots.txt
│   └── images/                # ← Add hero images here
│
├── src/
│   ├── content/
│   │   ├── config.ts          # ← Content collection schema (frontmatter rules)
│   │   └── guides/            # ← YOUR BLOG POSTS GO HERE (.md or .mdx)
│   │       ├── ollama-linux-setup.md
│   │       └── ansible-homelab.md
│   │
│   ├── layouts/
│   │   ├── BaseLayout.astro   # HTML wrapper: <head>, Nav, Footer
│   │   └── PostLayout.astro   # Blog post wrapper (prose styles)
│   │
│   ├── components/
│   │   ├── Nav.astro          # Fixed navigation bar
│   │   ├── Footer.astro       # Site footer
│   │   ├── PostCard.astro     # Reusable post card component
│   │   └── NewsletterForm.astro
│   │
│   ├── pages/
│   │   ├── index.astro        # Homepage (/)
│   │   ├── tools.astro        # Tools page (/tools)
│   │   ├── guides/
│   │   │   ├── index.astro    # All guides listing (/guides)
│   │   │   └── [slug].astro   # Individual post (/guides/ollama-linux-setup)
│   │   └── rss.xml.ts         # RSS feed (/rss.xml)
│   │
│   └── styles/
│       └── global.css         # CSS variables, base styles, fonts
│
├── astro.config.mjs           # Astro config (site URL, integrations)
├── tailwind.config.mjs        # Tailwind theme (colors, fonts)
├── tsconfig.json
└── package.json
```

---

## How to Write a New Post

### 1. Create the file

Add a `.md` or `.mdx` file inside `src/content/guides/`:

```
src/content/guides/proxmox-setup-2026.md
```

The filename becomes the URL slug:  
→ `https://linuxcore.dev/guides/proxmox-setup-2026`

---

### 2. Add frontmatter

Every post needs a frontmatter block at the top:

```markdown
---
title: "The Ultimate Proxmox Setup Guide (2026)"
description: "Complete step-by-step Proxmox VE installation and configuration for homelabs."
pubDate: 2026-01-20
pillar: "Infrastructure"
type: "PILLAR"
tags: ["proxmox", "virtualization", "homelab"]
readTime: 15
featured: false
draft: false
heroImage: "/images/proxmox-setup.png"   # optional
---

## Introduction

Your content starts here...
```

**Frontmatter fields:**

| Field         | Required | Values                                                                                              |
|:--------------|:--------:|:----------------------------------------------------------------------------------------------------|
| `title`       | ✅       | String                                                                                              |
| `description` | ✅       | String (used for SEO meta and cards)                                                                |
| `pubDate`     | ✅       | `YYYY-MM-DD`                                                                                        |
| `pillar`      | ✅       | `Infrastructure` · `Self-Hosted AI` · `Linux Automation` · `Monitoring` · `Security` · `AWS Hybrid` |
| `type`        | ✅       | `PILLAR` · `CLUSTER` · `UNIQUE`                                                                     |
| `tags`        | ✅       | Array of strings                                                                                    |
| `readTime`    | ✅       | Number (minutes)                                                                                    |
| `featured`    |          | `true` / `false` — one post can be featured on the homepage                                         |
| `draft`       |          | `true` hides post from build output                                                                 |
| `heroImage`   |          | Path to image in `/public/` — e.g. `/images/my-post.png`                                            |
| `updatedDate` |          | `YYYY-MM-DD` — shows "Updated" date on post                                                         |

---

### 3. Write in Markdown

Standard Markdown works. Code blocks get syntax-highlighted automatically via **Shiki**:

````markdown
## Step 1 — Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

## Step 2 — Start Monitoring Stack

```yaml
# docker-compose.yml
services:
  prometheus:
    image: prom/prometheus
    ports: ["9090:9090"]
```
````

Tables, blockquotes, and inline code all work out of the box.

---

### 4. Use MDX for interactive content (optional)

Rename the file to `.mdx` and import Astro components:

```mdx
---
title: "My MDX Post"
...
---

import NewsletterForm from '../../components/NewsletterForm.astro';

## My Content

Regular markdown here...

<NewsletterForm />

More markdown below...
```

---

## Adding a New Page

Create a `.astro` file in `src/pages/`:

```astro
---
// src/pages/my-lab.astro
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout title="My Lab Setup">
  <section style="padding: 60px 40px; max-width: 1100px; margin: 0 auto;">
    <h1>My Lab</h1>
    <p>Content goes here...</p>
  </section>
</BaseLayout>
```

This automatically gets the Nav, Footer, and all SEO meta tags.

---

## Customising the Theme

Edit `src/styles/global.css` — all colours are CSS variables at the top:

```css
:root {
  --green:       #00ff88;   /* primary brand colour */
  --cyan:        #00e5ff;   /* self-hosted AI accent */
  --amber:       #ffb300;   /* automation / AWS accent */
  --red:         #ff4466;   /* security accent */
  --purple:      #b388ff;   /* monitoring accent */
  --bg:          #060c06;   /* page background */
  --text:        #c8e6c8;   /* body text */
  --border:      #1a2e1a;   /* card borders */
}
```

---

## Newsletter Setup

Open `src/components/NewsletterForm.astro` and replace the placeholder comment with your real API call.

**Buttondown (recommended — simple, cheap):**

```javascript
await fetch('https://api.buttondown.email/v1/subscribers', {
  method: 'POST',
  headers: {
    Authorization: 'Token YOUR_BUTTONDOWN_API_KEY',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ email }),
});
```

**ConvertKit:**

```javascript
await fetch(`https://api.convertkit.com/v3/forms/YOUR_FORM_ID/subscribe`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ api_key: 'YOUR_API_KEY', email }),
});
```

---

## Deploying to Cloudflare Pages

This is the recommended deployment — free, global CDN, automatic HTTPS, and near-perfect Lighthouse scores.

### First deploy

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
npm run build
wrangler pages deploy dist/ --project-name linuxcore-dev
```

### Auto-deploy on Git push (recommended)

1. Push this repo to GitHub
2. Go to **Cloudflare Dashboard → Pages → Create a project**
3. Connect your GitHub repo
4. Set build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. Click **Save and Deploy**

Every `git push` to `main` now triggers an automatic deploy. Pull requests get preview URLs automatically.

### Set your domain

In Cloudflare Pages → your project → **Custom domains** → Add `linuxcore.dev`.  
Cloudflare handles the SSL certificate automatically.

---

## Updating the Site URL

Before deploying, update `astro.config.mjs`:

```js
export default defineConfig({
  site: 'https://linuxcore.dev',   // ← your actual domain
  ...
});
```

This is used for the sitemap, RSS feed, and canonical URLs.

---

## Adding Tools

Edit `src/pages/tools.astro` — find the `tools` array at the top and add entries:

```js
{
  name: 'Your Tool',
  desc: 'What it does and why you use it.',
  badge: 'FREE',        // FREE | FREEMIUM | AFFILIATE
  link: 'https://...',
  guide: '/guides/your-guide-slug',   // or null
}
```

---

## SEO Checklist for Every Post

- [ ] `title` is 50–60 characters
- [ ] `description` is 120–160 characters, includes the target keyword
- [ ] Target keyword appears in H1, first paragraph, and at least one H2
- [ ] Internal links to related posts
- [ ] Code blocks have language specified (` ```bash `, ` ```yaml `, etc.)
- [ ] `heroImage` added for social sharing (1200×630px)
- [ ] `readTime` is accurate (roughly: word count ÷ 250)

---

## Useful Commands

```bash
npm run dev          # Start dev server on :4321
npm run build        # Production build → dist/
npm run preview      # Serve dist/ locally
npx astro check      # TypeScript type-check all .astro files
npx astro sync       # Regenerate content collection types
```

---

## Stack Summary

| Layer        | Tool                  | Why                                     |
|:-------------|:----------------------|:----------------------------------------|
| Framework    | Astro 4               | Zero JS by default, perfect SEO, fast   |
| Styling      | Tailwind CSS          | Utility-first, no CSS bloat             |
| Content      | Markdown / MDX        | Write posts as `.md` files              |
| Syntax HL    | Shiki (built-in)      | Beautiful code blocks, zero config      |
| Hosting      | Cloudflare Pages      | Free, global CDN, auto HTTPS            |
| Email        | Buttondown            | Simple newsletter, €9/mo for 1K subs    |
| Analytics    | Plausible (optional)  | Privacy-first, add script to BaseLayout |
| Comments     | Giscus (optional)     | GitHub Discussions-powered, free        |
