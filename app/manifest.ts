import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Thriftly: find the best Goodwill near you",
    short_name: "Thriftly",
    description:
      "Find the best Goodwill near you, ranked 0 to 100 by neighborhood affluence.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafafa",
    theme_color: "#18181b",
    categories: ["shopping", "lifestyle", "utilities"],
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
    ],
  };
}
