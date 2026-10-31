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

export const exportRow = (o: Order): readonly string[] => [
  String(o.id),
  o.customerName,
  o.company ?? "",
  o.line1,
  o.line2 ?? "",
  o.city,
  o.state,
  o.zip,
  o.country,
  o.phone ?? "",
  o.email,
  String(o.weightOz),
  itemsSummary(o.lineItems),
];

export const unshippedCsv = (orders: readonly Order[]): string =>
  serializeCsv([EXPORT_HEADERS, ...orders.filter(isExportable).map(exportRow)]);

export const exportFilename = (now: Date): string =>
  `groove-unshipped-${now.toISOString().slice(0, 10)}.csv`;
