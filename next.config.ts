import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  outputFileTracingIncludes: {
    "/api/stores": ["./data/tract-centroids/**/*"],
  },
};

export default nextConfig;
