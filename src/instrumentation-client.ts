import posthog from "posthog-js";
import { INGEST_PATH, analyticsConfig } from "@/lib/analytics/config";
import { carriesSecret, isPrivatePath, optChoice, scrubProperties } from "@/lib/analytics/events";

// Behaviour analytics (PostHog), started before the page becomes interactive.
// Records page views and leaves (time on page, scroll depth), the events in
// lib/analytics/events.ts, and session replays with every typed value masked.
// Stripe's card fields live in Stripe's own iframes and are never seen.
// The admin is never recorded: it shows customers' names and addresses as page text.
// (Its pages also carry PostHog's ph-no-capture class, which blanks them in a replay.)
// The /privacy page says all of this in plain words; keep the two in step.
const config = analyticsConfig({
  key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
});

if (config && !isPrivatePath(window.location.pathname)) {
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
      // /thanks arrives with the order's Stripe session id in its address. A replay keeps
      // the address of the page it records, so that page load gets no replay.
      disable_session_recording: carriesSecret(window.location.search),
      // Last gate before anything is sent: nothing from the admin (should a visit ever
      // reach it without a fresh page load), and no order-opening ids in any URL.
      before_send: (event) => {
        if (!event || isPrivatePath(window.location.pathname)) return null;
        return {
          ...event,
          properties: scrubProperties(event.properties),
          ...(event.$set ? { $set: scrubProperties(event.$set) } : {}),
          ...(event.$set_once ? { $set_once: scrubProperties(event.$set_once) } : {}),
        };
      },
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
