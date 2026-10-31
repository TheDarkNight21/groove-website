import { describe, expect, it } from "vitest";
import { parseCsv } from "../csv";
import { matchShipments, readReport, type ShipmentRow } from "../tracking-import";
import { anOrder } from "./memory-store";

const row = (over: Partial<ShipmentRow> = {}): ShipmentRow => ({
  line: 2, orderNumber: null, tracking: "9400111899223100000001", carrier: "USPS", name: null, zip: null, status: null, ...over,
});

const ada = anOrder({ id: 1001, customerName: "Ada Lovelace", zip: "02134" });
const bob = anOrder({ id: 1002, stripeSessionId: "cs_2", customerName: "Bob Ross", zip: "48168" });

describe("readReport", () => {
  it("finds columns by any alias, ignoring case and spacing", () => {
    const table = parseCsv("Created Date,ORDER ID,Recipient,  Zip Code ,Carrier,Tracking Number\n2026-10-31,1001,Ada Lovelace,02134,USPS,9400111899223100000001\n");
    const r = readReport(table);
    expect(r).toEqual({
      ok: true,
      value: [{ line: 2, orderNumber: "1001", tracking: "9400111899223100000001", carrier: "USPS", name: "Ada Lovelace", zip: "02134", status: null }],
    });
  });

  it("skips blank lines but keeps file line numbers", () => {
    const r = readReport(parseCsv("Order ID,Tracking Number\n,\n1001,94001\n"));
    expect(r.ok && r.value.map((x) => x.line)).toEqual([3]);
  });

  it("says which columns are missing", () => {
    const r = readReport(parseCsv("Recipient,Carrier\nAda,USPS\n"));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.kind).toBe("missing-columns");
  });

  it("accepts name + zip without an order column", () => {
    expect(readReport(parseCsv("Recipient,Zip,Tracking Number\n")).ok).toBe(true);
  });

  it("rejects an empty file", () => {
    expect(readReport([])).toEqual({ ok: false, error: { kind: "empty" } });
  });
});

describe("matchShipments", () => {
  it("is ready when the order number matches an unshipped order", () => {
    const p = matchShipments([row({ orderNumber: "1001" })], [ada, bob]);
    expect(p.ready.map((m) => m.order.id)).toEqual([1001]);
    expect(p.review).toEqual([]);
    expect(p.noMatch).toEqual([]);
  });

  it.each(["#1001", "GRV-1001", " 1001 "])("reads order number %j", (n) => {
    expect(matchShipments([row({ orderNumber: n })], [ada]).ready).toHaveLength(1);
  });

  it("falls back to name + ZIP and flags it for review", () => {
    const p = matchShipments([row({ name: "  ada   LOVELACE ", zip: "02134-1234" })], [ada, bob]);
    expect(p.ready).toEqual([]);
    expect(p.review.map((m) => [m.order.id, m.reason])).toEqual([[1001, "matched-by-name-zip"]]);
  });

  it("matches a ZIP whose leading zero a spreadsheet dropped", () => {
    expect(matchShipments([row({ name: "Ada Lovelace", zip: "2134" })], [ada]).review).toHaveLength(1);
  });

  it("ignores accents and punctuation in names", () => {
    const zoe = anOrder({ id: 7, customerName: "Zoë O'Brien", zip: "10001" });
    expect(matchShipments([row({ name: "Zoe O Brien", zip: "10001" })], [zoe]).review).toHaveLength(1);
  });

  it("falls back to name + ZIP when the order number is unknown", () => {
    const p = matchShipments([row({ orderNumber: "9999", name: "Bob Ross", zip: "48168" })], [ada, bob]);
    expect(p.review.map((m) => m.order.id)).toEqual([1002]);
  });

  it("is no match for an unknown order number without name + ZIP", () => {
    expect(matchShipments([row({ orderNumber: "9999" })], [ada]).noMatch.map((n) => n.reason)).toEqual(["unknown-order-number"]);
  });

  it("is no match when the order is already shipped or cancelled", () => {
    const shipped = anOrder({ id: 1001, status: "shipped", trackingNumber: "x", shippedAt: "t" });
    const cancelled = anOrder({ id: 1002, status: "cancelled" });
    const p = matchShipments([row({ orderNumber: "1001" }), row({ line: 3, orderNumber: "1002" })], [shipped, cancelled]);
    expect(p.noMatch.map((n) => n.reason)).toEqual(["order-not-unshipped", "order-not-unshipped"]);
  });

  it("never falls back by name onto a shipped order", () => {
    const shipped = anOrder({ status: "shipped", trackingNumber: "x", shippedAt: "t" });
    expect(matchShipments([row({ name: "Ada Lovelace", zip: "02134" })], [shipped]).noMatch[0].reason).toBe("no-name-zip-match");
  });

  it("refuses to guess between two unshipped orders with the same name and ZIP", () => {
    const twin = anOrder({ id: 1003, stripeSessionId: "cs_3" });
    expect(matchShipments([row({ name: "Ada Lovelace", zip: "02134" })], [ada, twin]).noMatch[0].reason).toBe("several-name-zip-matches");
  });

  it("is no match without a tracking number, or for a voided label", () => {
    const p = matchShipments([row({ orderNumber: "1001", tracking: null }), row({ line: 3, orderNumber: "1001", status: "Voided" })], [ada]);
    expect(p.noMatch.map((n) => n.reason)).toEqual(["no-tracking", "voided-label"]);
  });

  it("refuses a tracking number a spreadsheet turned into a float", () => {
    expect(matchShipments([row({ orderNumber: "1001", tracking: "1.234567890123457e+21" })], [ada]).noMatch[0].reason).toBe("garbled-tracking");
  });

  it("sends two labels for one order to review instead of ready", () => {
    const p = matchShipments([row({ orderNumber: "1001" }), row({ line: 3, orderNumber: "1001", tracking: "9400222" })], [ada]);
    expect(p.ready).toEqual([]);
    expect(p.review.map((m) => m.reason)).toEqual(["order-has-several-labels", "order-has-several-labels"]);
  });

  it("puts every row in exactly one bucket", () => {
    const rows = [
      row({ line: 2, orderNumber: "1001" }),
      row({ line: 3, name: "Bob Ross", zip: "48168" }),
      row({ line: 4, orderNumber: "5" }),
      row({ line: 5, tracking: null }),
    ];
    const p = matchShipments(rows, [ada, bob]);
    const lines = [...p.ready, ...p.review].map((m) => m.row.line).concat(p.noMatch.map((n) => n.row.line));
    expect(lines.sort()).toEqual([2, 3, 4, 5]);
  });
});
