import { PREORDER } from "./preorder.ts";

// What can be bought, one entry per flavor. The Stripe price for each entry is found
// by its lookup key, which is the same string in test and live mode, so no price id
// lives in the repo or in env. scripts/stripe-catalog.mts creates the prices.
//
// weightOz is the shipped weight of one pack (cans plus box), used for postage.
// PROVISIONAL: 170 oz is a comparable 12 x 12 fl oz energy-drink case (~10.6 lb),
// not a weighed Groove box. Weigh a packed box and replace it before shipping.

export type Product = {
  readonly sku: string;
  readonly name: string;
  readonly lookupKey: string;
  readonly weightOz: number;
};

export const CATALOG: readonly Product[] = [
  {
    sku: "groove-12pk",
    name: PREORDER.name,
    lookupKey: "groove-12pk",
    weightOz: 170,
  },
];

export const productBySku = (catalog: readonly Product[], sku: string): Product | undefined =>
  catalog.find((p) => p.sku === sku);

export const productByLookupKey = (catalog: readonly Product[], key: string): Product | undefined =>
  catalog.find((p) => p.lookupKey === key);
