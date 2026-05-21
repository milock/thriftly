import type { MetadataRoute } from "next";
import { STATES, CITIES } from "@/lib/cities";

// Must match the canonical host (www); apex URLs would redirect and GSC won't index them.
const SITE_URL = "https://www.thriftly.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const core: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/search`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/goodwill`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];
  const states: MetadataRoute.Sitemap = STATES.map((s) => ({
    url: `${SITE_URL}/goodwill/state/${s.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.6,
  }));
  const cities: MetadataRoute.Sitemap = CITIES.map((c) => ({
    url: `${SITE_URL}/goodwill/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }));
  return [...core, ...states, ...cities];
}
