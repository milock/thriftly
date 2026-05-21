import type { MetadataRoute } from "next";
import { METROS } from "@/lib/metros";

// Must match the canonical host (www); apex URLs would redirect and GSC won't index them.
const SITE_URL = "https://www.thriftly.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const core: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/search`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/goodwill`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];
  const cities: MetadataRoute.Sitemap = METROS.map((m) => ({
    url: `${SITE_URL}/goodwill/${m.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  return [...core, ...cities];
}
