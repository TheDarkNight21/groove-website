import type { Result } from "../email";
import { isOrderStatus, type LineItem, type NewOrder, type Order, type OrderStatus } from "./order";

export type StoreError =
  | { readonly kind: "upstream"; readonly status: number; readonly body: string }
  | { readonly kind: "network" }
  | { readonly kind: "bad-row"; readonly detail: string };

export type Shipment = { readonly tracking: string | null; readonly carrier: string | null; readonly shippedAt: string };

// Capability: everything fulfillment needs from the database. One real implementation
// (Supabase's REST API with the secret key) and one in memory for tests.
export type OrderStore = {
  // inserted=false means this Stripe session was already recorded (a redelivered event).
  readonly insert: (o: NewOrder) => Promise<Result<{ readonly inserted: boolean }, StoreError>>;
  readonly list: (q: { readonly livemode: boolean; readonly status?: OrderStatus }) => Promise<Result<readonly Order[], StoreError>>;
  readonly get: (id: number) => Promise<Result<Order | null, StoreError>>;
  // Only moves an order that is still unshipped; returns null if it wasn't.
  readonly markShipped: (id: number, s: Shipment) => Promise<Result<Order | null, StoreError>>;
  readonly markCancelled: (id: number) => Promise<Result<Order | null, StoreError>>;
  readonly markEmailSent: (id: number, at: string) => Promise<Result<null, StoreError>>;
};

// For logs: an upstream body can echo the failing row (names, addresses, emails),
// so only the kind and status ever leave this module in a log line.
export const storeErrorSummary = (e: StoreError): string =>
  e.kind === "upstream" ? `upstream ${e.status}` : e.kind === "bad-row" ? `bad-row ${e.detail}` : e.kind;

// ---- Row mapping (pure) ----

type Row = {
  id: number;
  stripe_session_id: string;
  livemode: boolean;
  created_at: string;
  customer_name: string;
  company: string | null;
  email: string;
  phone: string | null;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
  line_items: LineItem[];
  weight_oz: number;
  amount_paid_cents: number;
  currency: string;
  status: string;
  tracking_number: string | null;
  carrier: string | null;
  shipped_at: string | null;
  shipping_email_sent_at: string | null;
};

export const toRow = (o: NewOrder) => ({
  stripe_session_id: o.stripeSessionId,
  livemode: o.livemode,
  customer_name: o.customerName,
  company: o.company,
  email: o.email,
  phone: o.phone,
  address_line1: o.line1,
  address_line2: o.line2,
  city: o.city,
  state: o.state,
  zip: o.zip,
  country: o.country,
  line_items: o.lineItems,
  weight_oz: o.weightOz,
  amount_paid_cents: o.amountPaidCents,
  currency: o.currency,
});

export function fromRow(r: Row): Result<Order, StoreError> {
  if (!isOrderStatus(r.status)) return { ok: false, error: { kind: "bad-row", detail: `status ${r.status}` } };
  return {
    ok: true,
    value: {
      id: r.id,
      stripeSessionId: r.stripe_session_id,
      livemode: r.livemode,
      createdAt: r.created_at,
      customerName: r.customer_name,
      company: r.company,
      email: r.email,
      phone: r.phone,
      line1: r.address_line1,
      line2: r.address_line2,
      city: r.city,
      state: r.state,
      zip: r.zip,
      country: r.country,
      lineItems: r.line_items,
      weightOz: r.weight_oz,
      amountPaidCents: r.amount_paid_cents,
      currency: r.currency,
      status: r.status,
      trackingNumber: r.tracking_number,
      carrier: r.carrier,
      shippedAt: r.shipped_at,
      shippingEmailSentAt: r.shipping_email_sent_at,
    },
  };
}

const traverse = (rows: readonly Row[]): Result<readonly Order[], StoreError> =>
  rows.reduce<Result<readonly Order[], StoreError>>((acc, r) => {
    if (!acc.ok) return acc;
    const o = fromRow(r);
    return o.ok ? { ok: true, value: [...acc.value, o.value] } : o;
  }, { ok: true, value: [] });

// ---- Supabase REST implementation (the effect edge) ----

export type SupabaseServerConfig = { readonly url: string; readonly secretKey: string };

export function supabaseOrderStore(cfg: SupabaseServerConfig, fetchImpl: typeof fetch = fetch): OrderStore {
  const base = `${cfg.url.replace(/\/$/, "")}/rest/v1/orders`;
  // sb_secret_… keys go in apikey only; a legacy service_role JWT also needs Authorization.
  const headers: Record<string, string> = {
    apikey: cfg.secretKey,
    "Content-Type": "application/json",
    ...(cfg.secretKey.startsWith("eyJ") ? { Authorization: `Bearer ${cfg.secretKey}` } : {}),
  };

  async function call(path: string, init: RequestInit): Promise<Result<Row[], StoreError>> {
    try {
      const res = await fetchImpl(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers as object) } });
      const body = await res.text();
      if (!res.ok) return { ok: false, error: { kind: "upstream", status: res.status, body } };
      return { ok: true, value: body === "" ? [] : (JSON.parse(body) as Row[]) };
    } catch {
      return { ok: false, error: { kind: "network" } };
    }
  }

  const first = (r: Result<Row[], StoreError>): Result<Order | null, StoreError> => {
    if (!r.ok) return r;
    return r.value.length === 0 ? { ok: true, value: null } : fromRow(r.value[0]);
  };

  const patch = (filter: string, body: object) =>
    call(`?${filter}`, { method: "PATCH", body: JSON.stringify(body), headers: { Prefer: "return=representation" } });

  return {
    async insert(o) {
      const r = await call("?on_conflict=stripe_session_id", {
        method: "POST",
        body: JSON.stringify(toRow(o)),
        headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
      });
      return r.ok ? { ok: true, value: { inserted: r.value.length > 0 } } : r;
    },
    async list({ livemode, status }) {
      const filters = [`livemode=eq.${livemode}`, ...(status ? [`status=eq.${status}`] : []), "order=id.desc", "select=*"];
      const r = await call(`?${filters.join("&")}`, { method: "GET" });
      return r.ok ? traverse(r.value) : r;
    },
    async get(id) {
      return first(await call(`?id=eq.${id}&select=*`, { method: "GET" }));
    },
    async markShipped(id, s) {
      return first(
        await patch(`id=eq.${id}&status=eq.unshipped`, {
          status: "shipped",
          tracking_number: s.tracking,
          carrier: s.carrier,
          shipped_at: s.shippedAt,
        }),
      );
    },
    async markCancelled(id) {
      return first(await patch(`id=eq.${id}&status=eq.unshipped`, { status: "cancelled" }));
    },
    async markEmailSent(id, at) {
      const r = await patch(`id=eq.${id}`, { shipping_email_sent_at: at });
      return r.ok ? { ok: true, value: null } : r;
    },
  };
}
