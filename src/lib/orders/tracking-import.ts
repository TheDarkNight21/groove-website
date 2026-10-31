import type { Result } from "../email";
import type { Order } from "./order";

// Reading Pirate Ship's shipment report. Its column set is user-configurable, so each
// field is found by any of several header names (case and spacing ignored). For
// matching by order number, turn on the "Order ID" column in Pirate Ship before exporting.
export const HEADER_ALIASES = {
  orderNumber: ["order id", "order number", "order #", "order no", "order"],
  tracking: ["tracking number", "tracking #", "tracking", "tracking no"],
  carrier: ["carrier"],
  name: ["recipient", "recipient name", "name", "ship to name", "to name", "full name"],
  zip: ["zip", "zip code", "zipcode", "postal code", "recipient zip", "to zip", "ship to zip"],
  status: ["status", "label status", "shipment status"],
} as const;

type Field = keyof typeof HEADER_ALIASES;

export type ShipmentRow = {
  readonly line: number; // 1-based row in the file, header = 1
  readonly orderNumber: string | null;
  readonly tracking: string | null;
  readonly carrier: string | null;
  readonly name: string | null;
  readonly zip: string | null;
  readonly status: string | null;
};

export type ReportError =
  | { readonly kind: "empty" }
  | { readonly kind: "missing-columns"; readonly need: string; readonly found: readonly string[] };

const norm = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, " ");

const cell = (row: readonly string[], i: number | undefined): string | null => {
  if (i === undefined) return null;
  const v = (row[i] ?? "").trim();
  return v === "" ? null : v;
};

// Pure: header row + data rows (already decoded from CSV or XLSX) into shipments.
export function readReport(table: readonly (readonly string[])[]): Result<readonly ShipmentRow[], ReportError> {
  if (table.length === 0) return { ok: false, error: { kind: "empty" } };
  const [header, ...body] = table;
  const normalized = header.map(norm);
  const index = Object.fromEntries(
    (Object.keys(HEADER_ALIASES) as Field[]).map((field) => {
      const aliases: readonly string[] = HEADER_ALIASES[field];
      const at = aliases.map((a) => normalized.indexOf(a)).find((i) => i >= 0);
      return [field, at];
    }),
  ) as Record<Field, number | undefined>;

  const canMatch = index.orderNumber !== undefined || (index.name !== undefined && index.zip !== undefined);
  if (index.tracking === undefined || !canMatch) {
    return {
      ok: false,
      error: {
        kind: "missing-columns",
        need: "a Tracking Number column, plus Order ID (or Recipient and Zip)",
        found: header,
      },
    };
  }

  const rows = body
    .map((row, i) => ({ row, line: i + 2 }))
    .filter(({ row }) => row.some((c) => c.trim() !== ""))
    .map(({ row, line }) => ({
      line,
      orderNumber: cell(row, index.orderNumber),
      tracking: cell(row, index.tracking),
      carrier: cell(row, index.carrier),
      name: cell(row, index.name),
      zip: cell(row, index.zip),
      status: cell(row, index.status),
    }));
  return { ok: true, value: rows };
}

export type MatchedShipment = {
  readonly row: ShipmentRow;
  readonly order: Order;
  readonly tracking: string;
  readonly carrier: string | null;
};

export type ReviewReason = "matched-by-name-zip" | "order-has-several-labels";
export type NoMatchReason =
  | "no-tracking"
  | "garbled-tracking"
  | "voided-label"
  | "unknown-order-number"
  | "order-not-unshipped"
  | "no-name-zip-match"
  | "several-name-zip-matches";

export type Preview = {
  readonly ready: readonly MatchedShipment[];
  readonly review: readonly (MatchedShipment & { readonly reason: ReviewReason })[];
  readonly noMatch: readonly { readonly row: ShipmentRow; readonly reason: NoMatchReason }[];
};

// "#1001", "GRV-1001", "1001" all name order 1001.
const orderId = (raw: string): number | null => {
  const digits = raw.match(/\d+/g);
  if (!digits || digits.length !== 1) return null;
  const n = Number(digits[0]);
  return Number.isSafeInteger(n) ? n : null;
};

const normName = (s: string): string =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const zip5 = (s: string): string => s.replace(/\D/g, "").padStart(5, "0").slice(0, 5);

const VOIDED = /void|refund|cancel/i;

// A spreadsheet that stored a long tracking number as a number keeps only ~15
// digits ("1.234567890123457e+21"). The real number is gone; never send that.
const GARBLED = /^\d+(\.\d+)?e[+-]?\d+$/i;

type Step =
  | { readonly kind: "matched"; readonly m: MatchedShipment; readonly byNameZip: boolean }
  | { readonly kind: "none"; readonly reason: NoMatchReason };

function matchRow(row: ShipmentRow, orders: readonly Order[]): Step {
  if (row.status && VOIDED.test(row.status)) return { kind: "none", reason: "voided-label" };
  if (!row.tracking) return { kind: "none", reason: "no-tracking" };
  if (GARBLED.test(row.tracking)) return { kind: "none", reason: "garbled-tracking" };
  const base = { row, tracking: row.tracking, carrier: row.carrier };

  if (row.orderNumber) {
    const id = orderId(row.orderNumber);
    const order = id === null ? undefined : orders.find((o) => o.id === id);
    if (order) {
      return order.status === "unshipped"
        ? { kind: "matched", m: { ...base, order }, byNameZip: false }
        : { kind: "none", reason: "order-not-unshipped" };
    }
    if (!row.name || !row.zip) return { kind: "none", reason: "unknown-order-number" };
  }

  if (!row.name || !row.zip) return { kind: "none", reason: "no-name-zip-match" };
  const name = normName(row.name);
  const zip = zip5(row.zip);
  const candidates = orders.filter(
    (o) => o.status === "unshipped" && normName(o.customerName) === name && zip5(o.zip) === zip,
  );
  if (candidates.length === 0) return { kind: "none", reason: "no-name-zip-match" };
  if (candidates.length > 1) return { kind: "none", reason: "several-name-zip-matches" };
  return { kind: "matched", m: { ...base, order: candidates[0] }, byNameZip: true };
}

// Pure: every row lands in exactly one bucket. Exact order-number matches are ready;
// a name + ZIP fallback, or two labels for one order, needs a human look.
export function matchShipments(rows: readonly ShipmentRow[], orders: readonly Order[]): Preview {
  const steps = rows.map((row) => matchRow(row, orders));
  const labelsPerOrder = steps.reduce<ReadonlyMap<number, number>>(
    (acc, s) => (s.kind === "matched" ? new Map(acc).set(s.m.order.id, (acc.get(s.m.order.id) ?? 0) + 1) : acc),
    new Map(),
  );
  return steps.reduce<Preview>(
    (acc, s, i) => {
      if (s.kind === "none") return { ...acc, noMatch: [...acc.noMatch, { row: rows[i], reason: s.reason }] };
      if ((labelsPerOrder.get(s.m.order.id) ?? 0) > 1) {
        return { ...acc, review: [...acc.review, { ...s.m, reason: "order-has-several-labels" }] };
      }
      if (s.byNameZip) return { ...acc, review: [...acc.review, { ...s.m, reason: "matched-by-name-zip" }] };
      return { ...acc, ready: [...acc.ready, s.m] };
    },
    { ready: [], review: [], noMatch: [] },
  );
}

export const REVIEW_TEXT: Record<ReviewReason, string> = {
  "matched-by-name-zip": "Matched by name and ZIP, not order number",
  "order-has-several-labels": "More than one label for this order",
};

export const NO_MATCH_TEXT: Record<NoMatchReason, string> = {
  "no-tracking": "No tracking number",
  "garbled-tracking": "Tracking number was saved as a number and lost digits; export as CSV",
  "voided-label": "Label voided or refunded",
  "unknown-order-number": "No order with this number",
  "order-not-unshipped": "Order already shipped or cancelled",
  "no-name-zip-match": "No unshipped order with this name and ZIP",
  "several-name-zip-matches": "Several unshipped orders share this name and ZIP",
};
