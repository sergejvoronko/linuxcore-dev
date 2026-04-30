import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title:       z.string(),
    description: z.string(),
    pubDate:     z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    heroImage:   z.string().optional(),
    heroImageAlt:z.string().optional(),

    // 'homelab' → appears at /homelab/slug
    // 'astro'   → appears at /astro/slug
    // omit      → appears at /blog/slug only
    section: z.enum(['homelab', 'astro', 'aws']).optional(),

    tags:        z.array(z.string()).default([]),
    featured:    z.boolean().default(false),
    draft:       z.boolean().default(false),
    affiliate:   z.boolean().default(false),
    readingTime: z.number().optional(),

    // FAQ rich results (FAQPage JSON-LD)
    faqs: z.array(z.object({ q: z.string(), a: z.string() })).optional(),

    // Content architecture (planning metadata — not rendered)
    pillar: z.string().optional(),
    type:   z.enum(['PILLAR', 'CLUSTER', 'UNIQUE']).optional(),
  }),
});

export const collections = { blog };
