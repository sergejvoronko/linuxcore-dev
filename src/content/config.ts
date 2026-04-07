import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
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
    section: z.enum(['homelab', 'astro']).optional(),

    tags:        z.array(z.string()).default([]),
    featured:    z.boolean().default(false),
    draft:       z.boolean().default(false),
    affiliate:   z.boolean().default(false),
    readingTime: z.number().optional(),
  }),
});

export const collections = { blog };
