import { productByLookupKey, type Product } from "@/content/catalog";
import type { Result } from "../email";

export const ORDER_STATUSES = ["unshipped", "shipped", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const isOrderStatus = (s: unknown): s is OrderStatus =>
  typeof s === "string" && (ORDER_STATUSES as readonly string[]).includes(s);

export type LineItem = { readonly sku: string; readonly qty: number };

// An order as the webhook builds it, before the database gives it an id.
export type NewOrder = {
  readonly stripeSessionId: string;
  readonly livemode: boolean;
  readonly customerName: string;
  readonly company: string | null;
  readonly email: string;
  readonly phone: string | null;
  readonly line1: string;
  readonly line2: string | null;
  readonly city: string;
  readonly state: string;
  readonly zip: string;
  readonly country: string;
  readonly lineItems: readonly LineItem[];
  readonly weightOz: number;
  readonly amountPaidCents: number;
  readonly currency: string;
};

export type Order = NewOrder & {
  readonly id: number;
  readonly createdAt: string;
  readonly status: OrderStatus;
  readonly trackingNumber: string | null;
  readonly carrier: string | null;
  readonly shippedAt: string | null;
  readonly shippingEmailSentAt: string | null;
};

// The slice of a Checkout Session the mapping reads. Stripe's own type is wider;
// keeping this narrow lets tests build sessions by hand.
export type SessionAddress = {
  readonly line1: string | null;
  readonly line2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly postal_code: string | null;
  readonly country: string | null;
};

export type SessionInput = {
  readonly id: string;
  readonly livemode: boolean;
  readonly payment_status: string;
  readonly amount_total: number | null;
  readonly currency: string | null;
  readonly customer_details: {
    readonly email: string | null;
    readonly name: string | null;
    readonly phone: string | null;
    readonly business_name?: string | null;
  } | null;
  readonly collected_information: {
    readonly business_name?: string | null;
    readonly shipping_details: { readonly name: string; readonly address: SessionAddress } | null;
  } | null;
};

export type SessionLineItem = { readonly lookupKey: string | null; readonly quantity: number | null };

export type OrderError =
  | { readonly kind: "not-paid"; readonly paymentStatus: string }
  | { readonly kind: "missing-fields"; readonly fields: readonly string[] }
  | { readonly kind: "unknown-products"; readonly lookupKeys: readonly (string | null)[] }
  | { readonly kind: "no-items" };

const blankToNull = (s: string | null | undefined): string | null => {
  const t = s?.trim() ?? "";
  return t === "" ? null : t;
};

// Pure: a paid session plus its line items becomes an order, or every reason it can't.
export function orderFromSession(
  session: SessionInput,
  items: readonly SessionLineItem[],
  catalog: readonly Product[],
): Result<NewOrder, OrderError> {
  if (session.payment_status !== "paid") {
    return { ok: false, error: { kind: "not-paid", paymentStatus: session.payment_status } };
  }
  if (items.length === 0) return { ok: false, error: { kind: "no-items" } };

  const resolved = items.map((item) => ({
    item,
    product: item.lookupKey ? productByLookupKey(catalog, item.lookupKey) : undefined,
  }));
  const unknown = resolved.filter((r) => r.product === undefined || !r.item.quantity);
  if (unknown.length > 0) {
    return { ok: false, error: { kind: "unknown-products", lookupKeys: unknown.map((r) => r.item.lookupKey) } };
  }

  const ship = session.collected_information?.shipping_details ?? null;
  const addr = ship?.address;
  const customer = session.customer_details;
  const required = {
    "shipping name": blankToNull(ship?.name),
    email: blankToNull(customer?.email),
    "address line1": blankToNull(addr?.line1),
    city: blankToNull(addr?.city),
    state: blankToNull(addr?.state),
    zip: blankToNull(addr?.postal_code),
    country: blankToNull(addr?.country),
    "amount total": session.amount_total === null ? null : String(session.amount_total),
    currency: blankToNull(session.currency),
  };
  const missing = Object.entries(required)
    .filter(([, v]) => v === null)
    .map(([k]) => k);
  if (missing.length > 0) return { ok: false, error: { kind: "missing-fields", fields: missing } };

  const lineItems = resolved.map(({ item, product }) => ({ sku: product!.sku, qty: item.quantity! }));
  const weightOz = resolved.reduce((sum, { item, product }) => sum + product!.weightOz * item.quantity!, 0);

  return {
    ok: true,
    value: {
      stripeSessionId: session.id,
      livemode: session.livemode,
      customerName: required["shipping name"]!,
      company: blankToNull(session.collected_information?.business_name ?? customer?.business_name),
      email: required.email!.toLowerCase(),
      phone: blankToNull(customer?.phone),
      line1: required["address line1"]!,
      line2: blankToNull(addr?.line2),
      city: required.city!,
      state: required.state!,
      zip: required.zip!,
      country: required.country!,
      lineItems,
      weightOz,
      amountPaidCents: session.amount_total!,
      currency: required.currency!,
    },
  };
}

export function describeOrderError(e: OrderError): string {
  switch (e.kind) {
    case "not-paid":
      return `session payment_status is ${e.paymentStatus}, not paid`;
    case "missing-fields":
      return `session is missing ${e.fields.join(", ")}`;
    case "unknown-products":
      return `no catalog product for lookup key(s) ${e.lookupKeys.map(String).join(", ")}`;
    case "no-items":
      return "session has no line items";
    default: {
      const never: never = e;
      return never;
    }
  }
}

// "2x groove-12pk, 1x groove-12pk-mango": what goes in the packing-slip column.
// Plain ASCII, since it ends up on a printed label.
export const itemsSummary = (items: readonly LineItem[]): string =>
  items.map(({ sku, qty }) => `${qty}x ${sku}`).join(", ");
