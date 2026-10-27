import type { MetadataRoute } from "next";
import { SITE } from "@/content/site";

export const dynamic = "force-static";

// One page today. Add a row here when a route is added.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: new URL("/", SITE.url).href, changeFrequency: "weekly", priority: 1 }];
}
