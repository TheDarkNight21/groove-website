import { serializeCsv } from "./csv";
import { itemsSummary, type Order } from "./order";

// Pirate Ship's import columns, in its order. Changing a name breaks its auto-mapping.
export const EXPORT_HEADERS = [
  "Order Number",
  "Name",
  "Company",
  "Address 1",
  "Address 2",
  "City",
  "State",
  "Zip",
  "Country",
  "Phone",
  "Email",
  "Ounces",
  "Items",
] as const;

// Only orders that still need a label: unshipped, no tracking yet.
export const isExportable = (o: Order): boolean => o.status === "unshipped" && o.trackingNumber === null;

// Names and addresses are typed by customers. A cell starting with = + - @ (or tab/CR)
// runs as a formula if the file is opened in a spreadsheet, so it gets a leading space:
// a spreadsheet then reads it as text, and a label prints it the same.
const FORMULA_START = /^[=+\-@\t\r]/;
export const neutralize = (cell: string): string => (FORMULA_START.test(cell) ? ` ${cell}` : cell);

// A phone like +15555550100 is a number to a spreadsheet, not a formula; keep its +.
const PHONE = /^\+?[\d\s().-]+$/;
const phoneCell = (p: string | null): string => (p === null ? "" : PHONE.test(p) ? p : neutralize(p));

export const exportRow = (o: Order): readonly string[] => [
  String(o.id),
  neutralize(o.customerName),
  neutralize(o.company ?? ""),
  neutralize(o.line1),
  neutralize(o.line2 ?? ""),
  neutralize(o.city),
  neutralize(o.state),
  neutralize(o.zip),
  neutralize(o.country),
  phoneCell(o.phone),
  neutralize(o.email),
  String(o.weightOz),
  neutralize(itemsSummary(o.lineItems)),
];

export const unshippedCsv = (orders: readonly Order[]): string =>
  serializeCsv([EXPORT_HEADERS, ...orders.filter(isExportable).map(exportRow)]);

export const exportFilename = (now: Date): string =>
  `groove-unshipped-${now.toISOString().slice(0, 10)}.csv`;
