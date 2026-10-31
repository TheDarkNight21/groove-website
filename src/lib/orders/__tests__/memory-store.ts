import type { NewOrder, Order } from "../order";
import type { OrderStore } from "../store";

// In-memory OrderStore with the same contract as the Supabase one: unique
// stripe_session_id, ids from 1001, and only unshipped orders move.
export function memoryStore(seed: readonly Order[] = []): OrderStore & { readonly all: () => readonly Order[] } {
  let rows: Order[] = [...seed];
  let next = Math.max(1000, ...seed.map((o) => o.id)) + 1;
  const update = (id: number, f: (o: Order) => Order | null) => {
    const o = rows.find((r) => r.id === id);
    const changed = o ? f(o) : null;
    if (changed) rows = rows.map((r) => (r.id === id ? changed : r));
    return changed;
  };
  return {
    all: () => rows,
    async insert(o: NewOrder) {
      if (rows.some((r) => r.stripeSessionId === o.stripeSessionId)) return { ok: true, value: { inserted: false } };
      rows = [
        ...rows,
        { ...o, id: next++, createdAt: new Date(0).toISOString(), status: "unshipped", trackingNumber: null, carrier: null, shippedAt: null, shippingEmailSentAt: null },
      ];
      return { ok: true, value: { inserted: true } };
    },
    async list({ livemode, status }) {
      return { ok: true, value: rows.filter((r) => r.livemode === livemode && (!status || r.status === status)).sort((a, b) => b.id - a.id) };
    },
    async get(id) {
      return { ok: true, value: rows.find((r) => r.id === id) ?? null };
    },
    async markShipped(id, s) {
      return {
        ok: true,
        value: update(id, (o) =>
          o.status === "unshipped" ? { ...o, status: "shipped", trackingNumber: s.tracking, carrier: s.carrier, shippedAt: s.shippedAt } : null,
        ),
      };
    },
    async markCancelled(id) {
      return { ok: true, value: update(id, (o) => (o.status === "unshipped" ? { ...o, status: "cancelled" } : null)) };
    },
    async markEmailSent(id, at) {
      update(id, (o) => ({ ...o, shippingEmailSentAt: at }));
      return { ok: true, value: null };
    },
  };
}

export const anOrder = (over: Partial<Order> = {}): Order => ({
  id: 1001,
  stripeSessionId: "cs_test_1",
  livemode: false,
  createdAt: "2026-10-31T12:00:00.000Z",
  customerName: "Ada Lovelace",
  company: null,
  email: "ada@example.com",
  phone: "+15555550100",
  line1: "1 Main St",
  line2: null,
  city: "Boston",
  state: "MA",
  zip: "02134",
  country: "US",
  lineItems: [{ sku: "groove-12pk", qty: 1 }],
  weightOz: 170,
  amountPaidCents: 3600,
  currency: "usd",
  status: "unshipped",
  trackingNumber: null,
  carrier: null,
  shippedAt: null,
  shippingEmailSentAt: null,
  ...over,
});
