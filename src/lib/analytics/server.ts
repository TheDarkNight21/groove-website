import type { Result } from "../email";
import type { AnalyticsConfig } from "./config";
import type { ServerCapture } from "./events";

export type CaptureError = { readonly kind: "upstream"; readonly status: number } | { readonly kind: "network" };

// Capability: the one way server code records an event.
export type CaptureSender = (capture: ServerCapture, at: Date) => Promise<Result<true, CaptureError>>;

// Pure: the request PostHog's capture API expects.
export const captureRequest = (config: AnalyticsConfig, c: ServerCapture, at: Date): { readonly url: string; readonly body: string } => ({
  url: `${config.host}/i/v0/e/`,
  body: JSON.stringify({
    api_key: config.key,
    event: c.name,
    distinct_id: c.distinctId,
    timestamp: at.toISOString(),
    properties: { ...c.properties, ...(c.sessionId === undefined ? {} : { $session_id: c.sessionId }) },
  }),
});

// Real implementation: PostHog's HTTP capture API, straight from the server.
export const captureSender =
  (config: AnalyticsConfig, fetchImpl: typeof fetch = fetch): CaptureSender =>
  async (capture, at) => {
    const { url, body } = captureRequest(config, capture, at);
    try {
      const res = await fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
      return res.ok ? { ok: true, value: true } : { ok: false, error: { kind: "upstream", status: res.status } };
    } catch {
      return { ok: false, error: { kind: "network" } };
    }
  };

export const captureErrorSummary = (e: CaptureError): string => (e.kind === "upstream" ? `PostHog answered ${e.status}` : "network error");
