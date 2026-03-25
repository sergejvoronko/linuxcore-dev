import { defineCollection, z } from 'astro:content';

/**
 * Content Collections
 * Each collection maps to a folder inside src/content/
 * The schema validates your markdown frontmatter at build time.
 */

const guides = defineCollection({
  type: 'content',
  schema: z.object({
    title:       z.string(),
    description: z.string(),
    pubDate:     z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author:      z.string().default('linuxcore.dev'),
    pillar:      z.enum(['Infrastructure', 'Self-Hosted AI', 'Linux Automation', 'Monitoring', 'Security', 'AWS Hybrid']),
    type:        z.enum(['PILLAR', 'CLUSTER', 'UNIQUE']).default('CLUSTER'),
    tags:        z.array(z.string()).default([]),
    readTime:    z.number(),              // minutes
    draft:       z.boolean().default(false),
    featured:    z.boolean().default(false),
    heroImage:   z.string().optional(),  // path to image in /public/images/
  }),
});

export const collections = { guides };
