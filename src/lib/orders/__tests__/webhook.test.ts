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
  lineItems: async () => ({ ok: true, value: [{ lookupKey: "groove-12pk", quantity: 2 }] }),
  store,
  catalog: CATALOG,
});

describe("webhook signature", () => {
  it("accepts a correctly signed event and records the order", async () => {
    const body = eventBody("checkout.session.completed", session());
    const d = deps();
    const r = await handleWebhook(body, sign(body), d);
    expect(r).toEqual({ ok: true, value: { kind: "recorded", sessionId: "cs_test_abc" } });
    expect(webhookStatus(r)).toBe(200);
    const [order] = d.store.all();
    expect(order).toMatchObject({
      id: 1001,
      customerName: "Ada Lovelace",
      email: "ada@example.com",
      zip: "02134",
      lineItems: [{ sku: "groove-12pk", qty: 2 }],
      weightOz: 340,
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
