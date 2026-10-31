import type { NextConfig } from "next";

// Served by Vercel. Pages still prerender as static HTML; the route handlers under
// app/api (checkout, the Stripe webhook, the admin) run as functions.
const nextConfig: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
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
