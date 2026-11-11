// Where events go. Both values are public by design (the project key ships in the
// page), so the browser and the webhook read the same two variables. Without them
// nothing is recorded anywhere: local runs and previews stay silent unless given a key.

export type AnalyticsConfig = {
  readonly key: string;
  readonly host: string; // PostHog's ingest origin, e.g. https://us.i.posthog.com
  readonly assetsHost: string; // where its scripts are served from
  readonly uiHost: string; // the app, for links back from the toolbar
};

// The path on our own domain that forwards to PostHog (see next.config.ts), so
// requests are first-party.
export const INGEST_PATH = "/ingest";

const INGEST_SUFFIX = ".i.posthog.com";

export const analyticsConfig = (env: { readonly key: string | undefined; readonly host: string | undefined }): AnalyticsConfig | undefined => {
  const key = env.key?.trim();
  const host = env.host?.trim().replace(/\/+$/, "");
  if (!key || !host) return undefined;
  let origin: URL;
  try {
    origin = new URL(host);
  } catch {
    return undefined;
  }
  if (origin.protocol !== "https:") return undefined;
  // PostHog Cloud: us.i.posthog.com ingests, us-assets.i.posthog.com serves scripts,
  // us.posthog.com is the app. A self-hosted origin does all three.
  const cloud = origin.hostname.endsWith(INGEST_SUFFIX);
  const region = origin.hostname.slice(0, -INGEST_SUFFIX.length);
  return {
    key,
    host: origin.origin,
    assetsHost: cloud ? `https://${region}-assets${INGEST_SUFFIX}` : origin.origin,
    uiHost: cloud ? `https://${region}.posthog.com` : origin.origin,
  };
};
