import type { MetadataRoute } from "next";
import { SITE } from "@/content/site";
import { BRAND_COLORS } from "@/lib/record-art";

export const dynamic = "force-static";

// What Android and desktop Chrome use when the site is added to a home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    // Relative, like the icons: they resolve against the manifest's own URL.
    start_url: "./",
    display: "standalone",
    background_color: BRAND_COLORS.paper,
    theme_color: BRAND_COLORS.paper,
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
