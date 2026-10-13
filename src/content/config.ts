import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    updated: z.string().optional(),
    author: z.string().default('World Radio Stations'),
    tags: z.array(z.string()).default([]),
  }),
});

const stations = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    description: z.string(),
    founded: z.string().optional(),
    owner: z.string().optional(),
    headquarters: z.string().optional(),
    format: z.string(),
    frequencies: z.array(z.string()).default([]),
    website: z.string().optional(),
    language: z.string().default('English'),
    country: z.string().default('United States'),
    slogan: z.string().optional(),
    /** <title> override, for stations searched by a specific frequency. */
    metaTitle: z.string().optional(),
    /** Meta description override (otherwise built from the frequencies). */
    metaDescription: z.string().optional(),
    /** Term the embedded player filters by, when the Radio Browser name differs. */
    playerSearch: z.string().optional(),
    /** Station-specific questions, shown on the page and in the FAQ markup. */
    faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  }),
});

export const collections = { blog, stations };
