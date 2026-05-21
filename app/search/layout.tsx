import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find Goodwill stores near you",
  description:
    "Search Goodwill thrift stores near you on a live map. See every store ranked 0 to 100 by neighborhood affluence, with directions, hours, and filters.",
  alternates: { canonical: "/search" },
};

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children;
}
