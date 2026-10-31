import { SITE } from "@/content/site";
import type { Result } from "../email";
import type { Order } from "./order";

// Public tracking pages for the carriers Pirate Ship sells. Anything else gets the
// number without a link rather than a guessed URL.
const TRACKING_URLS: Readonly<Record<string, (n: string) => string>> = {
  usps: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`,
  ups: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
};

export const carrierKey = (carrier: string | null): string | null => {
  const c = carrier?.toLowerCase() ?? "";
  if (c.includes("usps") || c.includes("postal")) return "usps";
  if (c.includes("ups")) return "ups";
  return null;
};

export const trackingUrl = (carrier: string | null, tracking: string): string | null => {
  const key = carrierKey(carrier);
  return key ? TRACKING_URLS[key](tracking) : null;
};

export type OutgoingEmail = {
  readonly from: string;
  readonly to: string;
  readonly subject: string;
  readonly text: string;
};

// Pure: what the customer reads when their order ships.
export function shippingEmail(
  order: Pick<Order, "id" | "email" | "customerName">,
  tracking: string,
  carrier: string | null,
  from: string,
): OutgoingEmail {
  const url = trackingUrl(carrier, tracking);
  const first = order.customerName.trim().split(/\s+/)[0] ?? "";
  const via = carrier ? ` with ${carrier}` : "";
  return {
    from,
    to: order.email,
    subject: `Your ${SITE.name} order #${order.id} has shipped`,
    text: [
      `Hi ${first},`,
      "",
      `Your order #${order.id} is on its way${via}.`,
      "",
      `Tracking number: ${tracking}`,
      ...(url ? [`Track it: ${url}`] : []),
      "",
      "Questions? Reply to this email.",
      "",
      SITE.name,
    ].join("\n"),
  };
}

export type SendError = { readonly kind: "upstream"; readonly status: number; readonly body: string } | { readonly kind: "network" };

// Capability: the one way the fulfillment code sends mail.
export type EmailSender = (mail: OutgoingEmail) => Promise<Result<{ readonly id: string }, SendError>>;

// Real implementation: Resend's HTTP API, on the verified groovedrinks.com domain.
export const resendSender =
  (apiKey: string, fetchImpl: typeof fetch = fetch): EmailSender =>
  async (mail) => {
    try {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: mail.from, to: [mail.to], subject: mail.subject, text: mail.text }),
      });
      const body = await res.text();
      if (!res.ok) return { ok: false, error: { kind: "upstream", status: res.status, body } };
      const id = (JSON.parse(body) as { id?: string }).id ?? "";
      return { ok: true, value: { id } };
    } catch {
      return { ok: false, error: { kind: "network" } };
    }
  };
