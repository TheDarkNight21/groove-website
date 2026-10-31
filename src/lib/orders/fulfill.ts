import type { Result } from "../email";
import type { Order } from "./order";
import { shippingEmail, type EmailSender, type SendError } from "./shipping-email";
import type { OrderStore, StoreError } from "./store";

export type ShipRequest = { readonly orderId: number; readonly tracking: string | null; readonly carrier: string | null };

export type ShipOutcome =
  | { readonly kind: "shipped"; readonly orderId: number; readonly emailed: boolean }
  | { readonly kind: "email-failed"; readonly orderId: number; readonly error: SendError }
  | { readonly kind: "not-unshipped"; readonly orderId: number }
  | { readonly kind: "store-failed"; readonly orderId: number; readonly error: StoreError };

export type FulfillDeps = {
  readonly store: OrderStore;
  readonly send: EmailSender;
  readonly from: string;
  readonly now: () => Date;
};

// Marks one order shipped, then emails the customer if there's a tracking number.
// The database write comes first: a mail failure leaves the order shipped and says so,
// and shipping_email_sent_at stays empty so it's visible in the list.
export async function shipOrder(req: ShipRequest, deps: FulfillDeps): Promise<ShipOutcome> {
  const at = deps.now().toISOString();
  const moved = await deps.store.markShipped(req.orderId, { tracking: req.tracking, carrier: req.carrier, shippedAt: at });
  if (!moved.ok) return { kind: "store-failed", orderId: req.orderId, error: moved.error };
  if (moved.value === null) return { kind: "not-unshipped", orderId: req.orderId };
  if (!req.tracking) return { kind: "shipped", orderId: req.orderId, emailed: false };

  const sent = await deps.send(shippingEmail(moved.value, req.tracking, req.carrier, deps.from));
  if (!sent.ok) return { kind: "email-failed", orderId: req.orderId, error: sent.error };
  const marked = await deps.store.markEmailSent(req.orderId, deps.now().toISOString());
  if (!marked.ok) return { kind: "store-failed", orderId: req.orderId, error: marked.error };
  return { kind: "shipped", orderId: req.orderId, emailed: true };
}

// Orders are independent, but sending sequentially keeps us inside Resend's
// per-second rate limit for a daily batch of labels.
export async function shipAll(reqs: readonly ShipRequest[], deps: FulfillDeps): Promise<readonly ShipOutcome[]> {
  return reqs.reduce<Promise<readonly ShipOutcome[]>>(
    async (acc, r) => [...(await acc), await shipOrder(r, deps)],
    Promise.resolve([]),
  );
}

// The apply step trusts nothing from the browser but the ids and tracking it confirmed.
export function parseShipRequests(body: unknown): Result<readonly ShipRequest[], string> {
  const list = (body as { shipments?: unknown })?.shipments;
  if (!Array.isArray(list) || list.length === 0) return { ok: false, error: "no shipments" };
  const parsed = list.map((x: unknown) => {
    const r = x as Record<string, unknown>;
    const id = Number(r?.orderId);
    const tracking = typeof r?.tracking === "string" && r.tracking.trim() !== "" ? r.tracking.trim() : null;
    const carrier = typeof r?.carrier === "string" && r.carrier.trim() !== "" ? r.carrier.trim() : null;
    return Number.isSafeInteger(id) && id > 0 && tracking ? { orderId: id, tracking, carrier } : null;
  });
  return parsed.every((p) => p !== null)
    ? { ok: true, value: parsed as ShipRequest[] }
    : { ok: false, error: "each shipment needs an orderId and a tracking number" };
}

export const isUnshipped = (o: Order): boolean => o.status === "unshipped";
