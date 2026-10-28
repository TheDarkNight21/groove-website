import type { MetadataRoute } from "next";
import { LAB } from "@/content/lab";
import { SITE } from "@/content/site";

export const dynamic = "force-static";

// Add a row here when a route is added.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: new URL("/", SITE.url).href, changeFrequency: "weekly", priority: 1 },
    { url: new URL(LAB.path, SITE.url).href, changeFrequency: "monthly", priority: 0.8 },
  ];
}
