import type { MetadataRoute } from "next";

const SITE_URL = "https://thriftly.xyz";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep crawlers out of the JSON API; the indexable content is in the pages.
      disallow: "/api/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
