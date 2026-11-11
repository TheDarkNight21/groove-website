"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/client";
import { HOME_SECTIONS } from "@/lib/analytics/events";

// Says once per page view when each homepage section's heading scrolls into view, so
// we can see how far down people read. Renders nothing.
export function SectionWatch() {
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const section = HOME_SECTIONS.find((id) => id === entry.target.id);
          if (section) track({ kind: "section_viewed", section });
          observer.unobserve(entry.target);
        }
      },
      { threshold: 1 },
    );
    for (const id of HOME_SECTIONS) {
      const heading = document.getElementById(id);
      if (heading) observer.observe(heading);
    }
    return () => observer.disconnect();
  }, []);
  return null;
}
