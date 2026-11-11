import posthog from "posthog-js";
import { INGEST_PATH, analyticsConfig } from "@/lib/analytics/config";
import { optChoice } from "@/lib/analytics/events";

// Behaviour analytics (PostHog), started before the page becomes interactive.
// Records page views and leaves (time on page, scroll depth), the events in
// lib/analytics/events.ts, and session replays with every typed value masked.
// Stripe's card fields live in Stripe's own iframes and are never seen.
// The /privacy page says all of this in plain words; keep the two in step.
const config = analyticsConfig({
  key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
});

if (config) {
  try {
    posthog.init(config.key, {
      api_host: INGEST_PATH,
      ui_host: config.uiHost,
      defaults: "2026-01-30",
      capture_pageview: "history_change",
      capture_pageleave: true,
      // A profile for every visitor, so people who ordered can be compared with people who didn't.
      person_profiles: "always",
      session_recording: { maskAllInputs: true },
      loaded: (ph) => {
        const choice = optChoice(window.location.search);
        if (choice === "off") ph.opt_out_capturing();
        if (choice === "on") ph.opt_in_capturing();
      },
    });
  } catch (e) {
    // Analytics never breaks the page.
    console.error("analytics did not start:", e instanceof Error ? e.message : String(e));
  }
}
