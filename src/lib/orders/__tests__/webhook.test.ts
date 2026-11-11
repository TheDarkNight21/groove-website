import Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { CATALOG } from "@/content/catalog";
import { verifier } from "../stripe";
import { handleWebhook, webhookErrorSummary, webhookStatus, type WebhookDeps } from "../webhook";
import { memoryStore } from "./memory-store";

// The real SDK signs and verifies; only the network-facing capabilities are in memory.
const SECRET = "whsec_test_secret";
const stripe = new Stripe("sk_test_unused");

const session = (over: Record<string, unknown> = {}) => ({
  id: "cs_test_abc",
  object: "checkout.session",
  livemode: false,
  payment_status: "paid",
  amount_total: 7200,
  currency: "usd",
  customer_details: { email: "Ada@Example.com", name: "Ada L", phone: "+15555550100", business_name: null },
  collected_information: {
    business_name: null,
    shipping_details: {
      name: "Ada Lovelace",
      address: { line1: "1 Main St", line2: "Apt 2", city: "Boston", state: "MA", postal_code: "02134", country: "US" },
    },
  },
  ...over,
});

const eventBody = (type: string, object: object, id = "evt_1") =>
  JSON.stringify({ id, object: "event", type, data: { object } });

const sign = (payload: string, secret = SECRET) => stripe.webhooks.generateTestHeaderString({ payload, secret });

const deps = (store = memoryStore()): WebhookDeps & { store: ReturnType<typeof memoryStore> } => ({
  verify: verifier(stripe, SECRET),
  lineItems: async () => ({ ok: true, value: [{ lookupKey: CATALOG[0].lookupKey, quantity: 2 }] }),
  store,
  catalog: CATALOG,
});

describe("webhook signature", () => {
  it("accepts a correctly signed event and records the order", async () => {
    const body = eventBody("checkout.session.completed", session());
    const d = deps();
    const r = await handleWebhook(body, sign(body), d);
    expect(r).toEqual({
      ok: true,
      value: {
        kind: "recorded",
        sessionId: "cs_test_abc",
        // No visitor on the session: the sale is filed under the Stripe session.
        paid: {
          name: "order_paid",
          properties: { skus: [CATALOG[0].sku], packs: 2, amount_cents: 7200, currency: "usd", livemode: false },
          distinctId: "cs_test_abc",
          sessionId: undefined,
        },
      },
    });
    expect(webhookStatus(r)).toBe(200);
    const [order] = d.store.all();
    expect(order).toMatchObject({
      id: 1001,
      customerName: "Ada Lovelace",
      email: "ada@example.com",
      zip: "02134",
      lineItems: [{ sku: CATALOG[0].sku, qty: 2 }],
      weightOz: CATALOG[0].weightOz * 2,
      amountPaidCents: 7200,
      status: "unshipped",
      trackingNumber: null,
    });
  });

  it("rejects a missing header with 400 and writes nothing", async () => {
    const body = eventBody("checkout.session.completed", session());
    const d = deps();
    const r = await handleWebhook(body, null, d);
    expect(r.ok).toBe(false);
    expect(webhookStatus(r)).toBe(400);
    expect(d.store.all()).toHaveLength(0);
  });

  it("rejects a signature made with another secret", async () => {
    const body = eventBody("checkout.session.completed", session());
    const d = deps();
    const r = await handleWebhook(body, sign(body, "whsec_someone_else"), d);
    expect(webhookStatus(r)).toBe(400);
    expect(d.store.all()).toHaveLength(0);
  });

  it("rejects a body altered after signing", async () => {
    const body = eventBody("checkout.session.completed", session());
    const tampered = body.replace("7200", "1");
    const d = deps();
    expect(webhookStatus(await handleWebhook(tampered, sign(body), d))).toBe(400);
    expect(d.store.all()).toHaveLength(0);
  });

  it("rejects a stale timestamp (replay)", async () => {
    const body = eventBody("checkout.session.completed", session());
    const old = stripe.webhooks.generateTestHeaderString({ payload: body, secret: SECRET, timestamp: Math.floor(Date.now() / 1000) - 3600 });
    expect(webhookStatus(await handleWebhook(body, old, deps()))).toBe(400);
  });
});

describe("webhook idempotency", () => {
  it("records a redelivered event once", async () => {
    const body = eventBody("checkout.session.completed", session());
    const d = deps();
    const first = await handleWebhook(body, sign(body), d);
    const second = await handleWebhook(body, sign(body), d);
    expect(first.ok && first.value.kind).toBe("recorded");
    expect(second).toEqual({ ok: true, value: { kind: "duplicate", sessionId: "cs_test_abc" } });
    expect(webhookStatus(second)).toBe(200);
    expect(d.store.all()).toHaveLength(1);
  });

  it("dedupes on the session, not the event id", async () => {
    const d = deps();
    const a = eventBody("checkout.session.completed", session(), "evt_a");
    const b = eventBody("checkout.session.completed", session(), "evt_b");
    await handleWebhook(a, sign(a), d);
    await handleWebhook(b, sign(b), d);
    expect(d.store.all()).toHaveLength(1);
  });

  it("records two different sessions as two orders", async () => {
    const d = deps();
    const a = eventBody("checkout.session.completed", session({ id: "cs_test_1" }));
    const b = eventBody("checkout.session.completed", session({ id: "cs_test_2" }));
    await handleWebhook(a, sign(a), d);
    await handleWebhook(b, sign(b), d);
    expect(d.store.all().map((o) => o.id)).toEqual([1001, 1002]);
  });
});

describe("webhook routing", () => {
  it("ignores other event types with 200", async () => {
    const body = eventBody("payment_intent.created", { id: "pi_1" });
    const d = deps();
    const r = await handleWebhook(body, sign(body), d);
    expect(r).toEqual({ ok: true, value: { kind: "ignored", reason: "event type payment_intent.created" } });
    expect(d.store.all()).toHaveLength(0);
  });

  it("ignores an unpaid session", async () => {
    const body = eventBody("checkout.session.completed", session({ payment_status: "unpaid" }));
    const d = deps();
    const r = await handleWebhook(body, sign(body), d);
    expect(r.ok && r.value.kind).toBe("ignored");
    expect(d.store.all()).toHaveLength(0);
  });

  it("fails with 500 (so Stripe retries) when a product isn't in the catalog", async () => {
    const body = eventBody("checkout.session.completed", session());
    const d = { ...deps(), lineItems: async () => ({ ok: true as const, value: [{ lookupKey: "mystery", quantity: 1 }] }) };
    const r = await handleWebhook(body, sign(body), d);
    expect(r.ok).toBe(false);
    expect(webhookStatus(r)).toBe(500);
  });

  it("fails with 500 when there's no shipping address", async () => {
    const body = eventBody("checkout.session.completed", session({ collected_information: { shipping_details: null } }));
    const r = await handleWebhook(body, sign(body), deps());
    expect(!r.ok && r.error.kind === "bad-order" && r.error.detail).toContain("shipping name");
  });
});

describe("webhook logging", () => {
  it("never puts an upstream body (which can echo the customer's row) in the log line", () => {
    const line = webhookErrorSummary({ kind: "store", error: { kind: "upstream", status: 400, body: "Failing row contains (Ada Lovelace, ada@example.com)" } });
    expect(line).toBe("store: upstream 400");
    expect(line).not.toContain("Ada");
  });
});

describe("the order's analytics event", () => {
  const visited = session({ metadata: { sku: CATALOG[0].sku, ph_distinct_id: "0190aaaa-visitor", ph_session_id: "0190bbbb-session" } });

  it("belongs to the visit that opened the checkout", async () => {
    const body = eventBody("checkout.session.completed", visited);
    const r = await handleWebhook(body, sign(body), deps());
    expect(r.ok && r.value.kind === "recorded" && r.value.paid).toMatchObject({
      name: "order_paid",
      distinctId: "0190aaaa-visitor",
      sessionId: "0190bbbb-session",
    });
  });

  it("is produced once: Stripe retrying the same event is a duplicate with nothing to send", async () => {
    const body = eventBody("checkout.session.completed", visited);
    const d = deps();
    await handleWebhook(body, sign(body), d);
    const again = await handleWebhook(body, sign(body), d);
    expect(again).toEqual({ ok: true, value: { kind: "duplicate", sessionId: "cs_test_abc" } });
  });

  it("ignores metadata that isn't an id rather than failing the order", async () => {
    const body = eventBody("checkout.session.completed", session({ metadata: { ph_distinct_id: "not an id <b>" } }));
    const r = await handleWebhook(body, sign(body), deps());
    expect(r.ok && r.value.kind === "recorded" && r.value.paid.distinctId).toBe("cs_test_abc");
  });
});
