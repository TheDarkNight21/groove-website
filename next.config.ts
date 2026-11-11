import type { NextConfig } from "next";
import { INGEST_PATH, analyticsConfig } from "./src/lib/analytics/config";

// Analytics requests go to our own domain and are forwarded to PostHog, so they are
// first-party. posthog-js already asks for its endpoints with a trailing slash, which
// is what this site serves; its script files end in an extension and keep none.
const analytics = analyticsConfig({ key: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, host: process.env.NEXT_PUBLIC_POSTHOG_HOST });

// Served by Vercel. Pages still prerender as static HTML; the route handlers under
// app/api (checkout, the Stripe webhook, the admin) run as functions.
const nextConfig: NextConfig = {
  trailingSlash: true,
  images: { unoptimized: true },
  rewrites: async () =>
    analytics
      ? [
          { source: `${INGEST_PATH}/static/:path*`, destination: `${analytics.assetsHost}/static/:path*` },
          { source: `${INGEST_PATH}/array/:path*`, destination: `${analytics.assetsHost}/array/:path*` },
          { source: `${INGEST_PATH}/:path*`, destination: `${analytics.host}/:path*` },
        ]
      : [],
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
