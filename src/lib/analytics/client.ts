import posthog from "posthog-js";
import { toCapture, type AnalyticsEvent, type VisitorIds } from "./events";

// The browser edge. PostHog is started in src/instrumentation-client.ts; until it is
// (no key configured, or the script was blocked) both of these do nothing.

const recording = (): boolean => posthog.__loaded && !posthog.has_opted_out_capturing();

export function track(event: AnalyticsEvent): void {
  if (!recording()) return;
  const { name, properties } = toCapture(event);
  posthog.capture(name, properties);
}

// This browser's ids, sent along when a checkout opens so the paid order can be tied
// to the visit. Nothing when the visitor isn't being recorded.
export const visitorIds = (): VisitorIds | undefined =>
  recording() ? { distinctId: posthog.get_distinct_id(), sessionId: posthog.get_session_id() || undefined } : undefined;
