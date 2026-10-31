import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseCsv, serializeCsv } from "../csv";
import { EXPORT_HEADERS, exportFilename, unshippedCsv } from "../export";
import { anOrder } from "./memory-store";

describe("unshipped CSV", () => {
  it("has exactly Pirate Ship's headers, in order", () => {
    const [header] = parseCsv(unshippedCsv([]));
    expect(header).toEqual([
      "Order Number", "Name", "Company", "Address 1", "Address 2", "City", "State", "Zip", "Country", "Phone", "Email", "Ounces", "Items",
    ]);
    expect(header).toEqual([...EXPORT_HEADERS]);
  });

  it("writes one row per order with every field in its column", () => {
    const csv = unshippedCsv([
      anOrder({ id: 1001, line2: "Apt 2", company: "Acme", lineItems: [{ sku: "groove-12pk", qty: 2 }], weightOz: 340 }),
    ]);
    expect(parseCsv(csv)[1]).toEqual([
      "1001", "Ada Lovelace", "Acme", "1 Main St", "Apt 2", "Boston", "MA", "02134", "US", "+15555550100", "ada@example.com", "340", "2x groove-12pk",
    ]);
  });

  it("keeps a ZIP's leading zero, quoted as text", () => {
    const csv = unshippedCsv([anOrder({ zip: "02134" })]);
    expect(csv).toContain('"02134"');
    expect(parseCsv(csv)[1][7]).toBe("02134");
  });

  it("writes empty optional fields as empty strings, not 'null'", () => {
    const row = parseCsv(unshippedCsv([anOrder({ company: null, line2: null, phone: null })]))[1];
    expect([row[2], row[4], row[9]]).toEqual(["", "", ""]);
    expect(unshippedCsv([anOrder({ company: null })])).not.toContain("null");
  });

  it("survives commas, quotes and newlines in names and addresses", () => {
    const tricky = anOrder({ customerName: 'Jo "JJ" Smith, Jr.', line1: "12 Elm St\nRear" });
    const row = parseCsv(unshippedCsv([tricky]))[1];
    expect(row[1]).toBe('Jo "JJ" Smith, Jr.');
    expect(row[3]).toBe("12 Elm St\nRear");
  });

  it("includes only unshipped orders without tracking", () => {
    const csv = unshippedCsv([
      anOrder({ id: 1, status: "unshipped" }),
      anOrder({ id: 2, status: "shipped", trackingNumber: "9400", shippedAt: "x" }),
      anOrder({ id: 3, status: "cancelled" }),
      anOrder({ id: 4, status: "unshipped", trackingNumber: "9400" }),
    ]);
    expect(parseCsv(csv).slice(1).map((r) => r[0])).toEqual(["1"]);
  });

  it("uses CRLF line endings and ends with one", () => {
    const csv = unshippedCsv([anOrder()]);
    expect(csv.split("\r\n")).toHaveLength(3);
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("names the file by date", () => {
    expect(exportFilename(new Date("2026-10-31T23:00:00Z"))).toBe("groove-unshipped-2026-10-31.csv");
  });
});

describe("CSV laws", () => {
  const rows = fc.array(fc.array(fc.string(), { minLength: 1, maxLength: 6 }), { minLength: 1, maxLength: 8 });

  it("parse ∘ serialize = id", () => {
    fc.assert(fc.property(rows, (rs) => {
      expect(parseCsv(serializeCsv(rs))).toEqual(rs);
    }));
  });

  it("serializing a concatenation is concatenating serializations", () => {
    fc.assert(fc.property(rows, rows, (a, b) => {
      expect(serializeCsv([...a, ...b])).toBe(serializeCsv(a) + serializeCsv(b));
    }));
  });

  it("reads unquoted fields, LF endings and a BOM", () => {
    expect(parseCsv("﻿a,b\nc,\n")).toEqual([["a", "b"], ["c", ""]]);
  });
});
