import type { NextConfig } from "next";

// Static export, served by Vercel at the domain root.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // cacheComponents / partialPrefetching are off: PPR can't run in export mode.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
