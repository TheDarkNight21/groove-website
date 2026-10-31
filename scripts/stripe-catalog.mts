// Makes sure every catalog product has an active Stripe price under its lookup key.
// Idempotent: products that already have one are left alone.
//   STRIPE_SECRET_KEY=sk_test_… node scripts/stripe-catalog.mts
// Refuses a live key unless --live is passed, so it can't touch live by accident.

import Stripe from "stripe";
import { CATALOG } from "../src/content/catalog.ts";
import { PREORDER } from "../src/content/preorder.ts";

// Carbonated soft drink, 0% juice: the tax code the live product uses.
const TAX_CODE = "txcd_41040002";

const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key) throw new Error("Set STRIPE_SECRET_KEY.");
const live = key.startsWith("sk_live_") || key.startsWith("rk_live_");
if (live && !process.argv.includes("--live")) throw new Error("That's a live key. Pass --live if you mean it.");

const stripe = new Stripe(key);
const unitAmount = PREORDER.cansPerPack * PREORDER.usdPerCan * 100;

for (const p of CATALOG) {
  const existing = await stripe.prices.list({ lookup_keys: [p.lookupKey], active: true, limit: 1 });
  if (existing.data[0]) {
    console.log(`${p.sku}: ${existing.data[0].id} already has lookup key ${p.lookupKey}`);
    continue;
  }
  const product = await stripe.products.create({
    name: `${p.name} · ${PREORDER.cansPerPack}-pack`,
    description: p.flavor,
    tax_code: TAX_CODE,
    metadata: { sku: p.sku, weight_oz: String(p.weightOz) },
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: unitAmount,
    tax_behavior: "exclusive",
    lookup_key: p.lookupKey,
  });
  console.log(`${p.sku}: created ${product.id} / ${price.id} (${live ? "live" : "test"})`);
}
