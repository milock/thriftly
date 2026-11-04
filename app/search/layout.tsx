import type { Metadata } from "next";
import {pageMetadata} from "@/lib/seo";

export const metadata: Metadata = pageMetadata(
  "Find Goodwill stores near you",
  "Search mapped Goodwill locations by ZIP code or address. Compare neighborhood scores, directions and available store hours.",
  "/search",
);


export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
