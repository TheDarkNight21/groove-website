import { describe, expect, it } from "vitest";
import { isAdminSession, sessionValue, tokenMatches } from "../admin-auth";
import { readEnv, isLiveKey } from "../env";
import { parseShipRequests, shipAll } from "../fulfill";
import type { OutgoingEmail, EmailSender } from "../shipping-email";
import { shippingEmail, trackingUrl } from "../shipping-email";
import { anOrder, memoryStore } from "./memory-store";

const capture = () => {
  const sent: OutgoingEmail[] = [];
  const send: EmailSender = async (m) => (sent.push(m), { ok: true, value: { id: "em_1" } });
  return { sent, send };
};
const now = () => new Date("2026-11-01T15:00:00Z");

describe("shipAll", () => {
  it("marks shipped, emails the customer the tracking link, and records the send", async () => {
    const store = memoryStore([anOrder()]);
    const { sent, send } = capture();
    const out = await shipAll([{ orderId: 1001, tracking: "9400111", carrier: "USPS" }], { store, send, from: "Groove <orders@groovedrinks.com>", now });
    expect(out).toEqual([{ kind: "shipped", orderId: 1001, emailed: true }]);
    expect(store.all()[0]).toMatchObject({ status: "shipped", trackingNumber: "9400111", carrier: "USPS", shippedAt: "2026-11-01T15:00:00.000Z", shippingEmailSentAt: "2026-11-01T15:00:00.000Z" });
    expect(sent[0].to).toBe("ada@example.com");
    expect(sent[0].text).toContain("https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111");
  });

  it("applies once: a second apply finds the order no longer unshipped and sends nothing", async () => {
    const store = memoryStore([anOrder()]);
    const { sent, send } = capture();
    const deps = { store, send, from: "x@groovedrinks.com", now };
    await shipAll([{ orderId: 1001, tracking: "1", carrier: "USPS" }], deps);
    const again = await shipAll([{ orderId: 1001, tracking: "2", carrier: "USPS" }], deps);
    expect(again).toEqual([{ kind: "not-unshipped", orderId: 1001 }]);
    expect(sent).toHaveLength(1);
    expect(store.all()[0].trackingNumber).toBe("1");
  });

  it("keeps the order shipped and says so when the email fails", async () => {
    const store = memoryStore([anOrder()]);
    const send: EmailSender = async () => ({ ok: false, error: { kind: "upstream", status: 429, body: "" } });
    const [out] = await shipAll([{ orderId: 1001, tracking: "1", carrier: "UPS" }], { store, send, from: "x", now });
    expect(out.kind).toBe("email-failed");
    expect(store.all()[0]).toMatchObject({ status: "shipped", shippingEmailSentAt: null });
  });
});

describe("parseShipRequests", () => {
  it("accepts ids with tracking", () => {
    expect(parseShipRequests({ shipments: [{ orderId: 1001, tracking: " 94 ", carrier: "" }] })).toEqual({ ok: true, value: [{ orderId: 1001, tracking: "94", carrier: null }] });
  });
  it.each([null, {}, { shipments: [] }, { shipments: [{ orderId: "x", tracking: "1" }] }, { shipments: [{ orderId: 1 }] }])("rejects %j", (b) => {
    expect(parseShipRequests(b).ok).toBe(false);
  });
});

describe("shipping email", () => {
  it("links USPS and UPS, and gives the bare number for anything else", () => {
    expect(trackingUrl("UPS Ground", "1Z9")).toBe("https://www.ups.com/track?tracknum=1Z9");
    expect(trackingUrl("USPS", "94")).toContain("tLabels=94");
    expect(trackingUrl("FedEx", "1")).toBeNull();
    const mail = shippingEmail(anOrder(), "77", "FedEx", "f");
    expect(mail.text).toContain("Tracking number: 77");
    expect(mail.text).not.toContain("Track it:");
    expect(mail.subject).toContain("#1001");
  });
});

describe("admin auth", () => {
  const token = "a".repeat(32);
  it("accepts the right token and the cookie it produces, and nothing else", () => {
    expect(tokenMatches(token, token)).toBe(true);
    expect(tokenMatches(token, token + "x")).toBe(false);
    expect(isAdminSession(token, sessionValue(token))).toBe(true);
    expect(isAdminSession(token, sessionValue("b".repeat(32)))).toBe(false);
    expect(isAdminSession(token, token)).toBe(false);
    expect(isAdminSession(undefined, sessionValue(token))).toBe(false);
  });
  it("refuses a short token outright", () => {
    expect(tokenMatches("short", "short")).toBe(false);
    expect(isAdminSession("short", sessionValue("short"))).toBe(false);
  });
});

describe("env", () => {
  it("reports every missing variable at once", () => {
    expect(readEnv({ ADMIN_TOKEN: "x", RESEND_API_KEY: " " }, ["ADMIN_TOKEN", "RESEND_API_KEY", "SUPABASE_URL"])).toEqual({ ok: false, error: { missing: ["RESEND_API_KEY", "SUPABASE_URL"] } });
  });
  it("knows a live key", () => {
    expect(isLiveKey("sk_live_x")).toBe(true);
    expect(isLiveKey("sk_test_x")).toBe(false);
  });
});
