# linuxcore.dev — Social Strategy

Internal doc. Not part of the site build.

## Handles (fill in)

| Platform | Handle / URL |
|---|---|
| X | `@TODO_X_HANDLE` |
| LinkedIn | `TODO_LINKEDIN_URL` |
| Bluesky | `@TODO.bsky.social` |
| Mastodon | `@TODO@TODO_INSTANCE` |
| Reddit | `u/TODO_REDDIT_USER` |
| Hacker News | `TODO_HN_USER` |
| GitHub | `github.com/sergejvoronko` |

Once handles exist, add them to the About page and the `sameAs` array in the site's Person/Organization structured data.

## Platforms and priorities

The audience is self-hosters, homelabbers, Linux admins, and devs running Astro on Cloudflare. Rank channels by where they already hang out:

1. **Reddit** — highest-intent traffic. Post to the subreddit that fits the topic, never cross-post the same text to several at once.
   - Homelab: r/homelab, r/selfhosted, r/HomeServer
   - Linux: r/linux, r/linuxadmin, r/Ubuntu, r/sysadmin
   - Astro/Cloudflare: r/astrojs, r/CloudFlare, r/webdev
   - AWS: r/aws
2. **Hacker News** — only for the strongest, most original posts (benchmarks, surprising findings, deep guides). Max ~1 submission per 2 weeks.
3. **Mastodon (fosstodon.org or hachyderm.io) and Bluesky** — the Linux/FOSS crowd is active here. Post every article.
4. **X** — post every article; hashtags help discovery a little.
5. **LinkedIn** — AWS, cost, and "lessons learned" angles do best. 1–2 per week max.

## Cadence

| Platform | New article | Resurfacing older posts |
|---|---|---|
| X | Day of publish + one follow-up tip 3–5 days later | 3×/week |
| Bluesky | Day of publish | 2×/week |
| Mastodon | Day of publish | 2×/week |
| LinkedIn | Day of publish (if topic fits) | 1×/week |
| Reddit | Day of publish, one best-fit subreddit | Only when a thread asks a question the post answers |
| Hacker News | Selected posts only, weekday 14:00–16:00 UTC | Never re-submit |

## Rules

- Lead with the problem and the fix, not "new blog post!".
- Reddit: write a self-contained text post (summary + key snippet), link at the bottom. Check each subreddit's self-promo rules first. Stay in the comments for the first 2 hours.
- HN: use the article title as-is, no editorializing. Link directly, no text body.
- Keep UTM tags consistent: `?utm_source=<platform>&utm_medium=social&utm_campaign=<slug>`. Skip UTMs on HN and Reddit (they look spammy there).
- One hero image per post (the article's hero .webp works everywhere).

## Templates

### X (≤280 chars)

```
<Problem in one line>.

<Fix in one line — concrete: flag, header, command>.

<Optional: one-number result>

<URL>

#<tag1> #<tag2>
```

### Bluesky (≤300 chars)

```
<Problem>. <Fix in one sentence>.

<One concrete detail or snippet line>

<URL>
```

### Mastodon (≤500 chars)

```
<Problem, 1–2 sentences>.

What the guide covers:
• <point 1>
• <point 2>
• <point 3>

<URL>

#<Tag1> #<Tag2> #<Tag3>
```
Use CamelCase hashtags (screen readers).

### LinkedIn

```
<Hook: a mistake or cost number>

<2–3 short paragraphs: context → what went wrong → the fix>

Key takeaways:
→ <1>
→ <2>
→ <3>

Full guide: <URL>

#<tag> #<tag> #<tag>
```

### Reddit (text post)

```
Title: <Specific problem + fix, no clickbait>

<2–4 paragraphs explaining the problem and the fix, with the key snippet inline.>

I wrote up the full version with <extra detail> here: <URL>

Happy to answer questions.
```

### Hacker News

```
Title: <Article title, verbatim>
URL: <canonical URL>
```

## Resurfacing older posts

- Keep a queue of evergreen posts (guides that still work). Rotate through the queue on the cadence above; no post more than once every 6 weeks per platform.
- Each resurface uses a **new angle**: a single tip, a code snippet, a "common mistake", or a stat from the article — never the same copy twice.
- When a post is updated (new version, new benchmark), treat it like a new article and reshare everywhere with "Updated for <version>".
- Tie posts to news: new Ubuntu / Samba / Astro / AWS releases → reshare the matching guide the same day.
- Check Search Console monthly; posts ranking positions 8–20 are the best candidates to push socially.

## Tracking

- Monthly: note clicks per platform (Cloudflare analytics referrers + UTM), newsletter signups, and top-performing post.
- Drop or reduce a platform that sends < 2% of social traffic after 3 months.
