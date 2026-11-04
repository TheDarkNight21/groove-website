import { readFileSync } from "node:fs";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CATALOG } from "@/content/catalog";
import { PREORDER } from "@/content/preorder";
import type { PaidSessionSummary } from "../../orders/stripe";
import { APPEARANCE, TOKENS } from "../appearance";
import { checkoutConfig, keyMode } from "../config";
import { preorderProduct } from "../product";
import { boundsOf, canStep, clampPacks, stepPacks, type PackBounds } from "../quantity";
import { orderSummary, packsLabel, payLabel, type SessionForSummary } from "../summary";
import { parseSessionId, thanksView } from "../thanks";

const miami = CATALOG[0];

const bounds: fc.Arbitrary<PackBounds> = fc
  .tuple(fc.integer({ min: 0, max: 50 }), fc.integer({ min: 0, max: 50 }))
  .map(([a, b]) => ({ min: Math.min(a, b), max: Math.max(a, b) }));

describe("pack quantity", () => {
  it("clamp lands inside the bounds and is idempotent", () => {
    fc.assert(
      fc.property(bounds, fc.integer({ min: -1000, max: 1000 }), (b, n) => {
        const c = clampPacks(n, b);
        expect(c).toBeGreaterThanOrEqual(b.min);
        expect(c).toBeLessThanOrEqual(b.max);
        expect(clampPacks(c, b)).toBe(c);
      }),
    );
  });

  it("a step moves by one or stays put at an edge, and up then down returns home", () => {
    fc.assert(
      fc.property(bounds, fc.integer({ min: 0, max: 50 }), (b, n) => {
        const q = clampPacks(n, b);
        const up = stepPacks(q, 1, b);
        expect(up - q).toBe(q < b.max ? 1 : 0);
        expect(canStep(q, 1, b)).toBe(q < b.max);
        expect(canStep(q, -1, b)).toBe(q > b.min);
        if (canStep(q, 1, b)) expect(stepPacks(up, -1, b)).toBe(q);
      }),
    );
  });

  it("stepper for the pre-order: 1 to maxPacks", () => {
    const b = { min: 1, max: PREORDER.maxPacks };
    expect(canStep(1, -1, b)).toBe(false);
    expect(canStep(PREORDER.maxPacks, 1, b)).toBe(false);
    expect(boundsOf({ minimum: 1, maximum: PREORDER.maxPacks })).toEqual(b);
    expect(boundsOf(null)).toBeUndefined();
    expect(boundsOf({ minimum: 5, maximum: 2 })).toBeUndefined();
  });
});

const amount = (cents: number) => ({ minorUnitsAmount: cents, amount: `$${(cents / 100).toFixed(2)}` });
const session = (over: Partial<SessionForSummary["total"]> = {}, quantity = 1): SessionForSummary => ({
  currency: "usd",
  minorUnitsAmountDivisor: 100,
  lineItems: [{ id: "li_1", quantity, adjustableQuantity: { minimum: 1, maximum: 10 } }],
  total: { total: amount(3600 * quantity), taxExclusive: amount(0), taxInclusive: amount(0), ...over },
});

describe("orderSummary", () => {
  it("reads the total from the session, in the site's money style", () => {
    const v = orderSummary(session({}, 2));
    expect(v.total).toBe("$72");
    expect(v.line).toEqual({ id: "li_1", packs: 2, bounds: { min: 1, max: 10 } });
    expect(payLabel(PREORDER.button, v.total)).toBe("Pre-order · $72");
  });

  it("shows a tax line only when tax isn't zero", () => {
    expect(orderSummary(session()).tax).toBeUndefined();
    expect(orderSummary(session({ total: amount(3825), taxExclusive: amount(225) })).tax).toEqual({
      label: "Tax",
      amount: "$2.25",
    });
    expect(orderSummary(session({ taxInclusive: amount(300) })).tax).toEqual({ label: "Includes tax", amount: "$3" });
  });

  it("offers no stepper unless the session has exactly one line", () => {
    const two = { ...session(), lineItems: [...session().lineItems, { id: "li_2", quantity: 1, adjustableQuantity: null }] };
    expect(orderSummary(two).line).toBeUndefined();
    expect(orderSummary({ ...session(), lineItems: [] }).line).toBeUndefined();
  });

  it("falls back to Stripe's own text for currencies without cents", () => {
    const yen = { ...session(), currency: "jpy", minorUnitsAmountDivisor: 1 };
    expect(orderSummary(yen).total).toBe(yen.total.total.amount);
  });

  it("packsLabel counts cans", () => {
    expect(packsLabel(1, 12)).toBe("1 pack · 12 cans");
    expect(packsLabel(3, 12)).toBe("3 packs · 36 cans");
  });
});

describe("checkoutConfig", () => {
  const ok = { STRIPE_SECRET_KEY: "sk_test_abc", NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_xyz" };

  it("needs both keys, and names every missing one", () => {
    expect(checkoutConfig({})).toEqual({
      ok: false,
      error: { kind: "missing", names: ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"] },
    });
    expect(checkoutConfig({ ...ok, STRIPE_SECRET_KEY: "  " }).ok).toBe(false);
  });

  it("refuses a test key paired with a live one", () => {
    expect(checkoutConfig({ ...ok, STRIPE_SECRET_KEY: "sk_live_abc" })).toEqual({ ok: false, error: { kind: "mode-mismatch" } });
  });

  it("refuses a secret key in the publishable slot", () => {
    expect(checkoutConfig({ ...ok, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "sk_test_abc" })).toEqual({
      ok: false,
      error: { kind: "unrecognized-key", name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" },
    });
  });

  it("passes the publishable key through when both agree", () => {
    expect(checkoutConfig(ok)).toEqual({ ok: true, value: { secretKey: "sk_test_abc", publishableKey: "pk_test_xyz", mode: "test" } });
    expect(keyMode("rk_live_1")).toBe("live");
    expect(keyMode("whsec_1")).toBeUndefined();
  });
});

const paid = (over: Partial<PaidSessionSummary> = {}): PaidSessionSummary => ({
  id: "cs_test_1",
  status: "complete",
  paymentStatus: "paid",
  amountTotal: 7200,
  currency: "usd",
  items: [{ lookupKey: miami.lookupKey, quantity: 2 }],
  ...over,
});

describe("thanksView", () => {
  it("names the flavor, the packs and what was paid", () => {
    expect(thanksView(paid(), CATALOG)).toEqual({
      ok: true,
      value: { lines: [{ product: miami, packs: 2 }], totalPacks: 2, paid: "$72" },
    });
  });

  it("falls back for anything not paid and complete, or not in the catalog", () => {
    expect(thanksView(paid({ status: "open" }), CATALOG).ok).toBe(false);
    expect(thanksView(paid({ paymentStatus: "unpaid" }), CATALOG).ok).toBe(false);
    expect(thanksView(paid({ amountTotal: null }), CATALOG).ok).toBe(false);
    expect(thanksView(paid({ items: [] }), CATALOG).ok).toBe(false);
    expect(thanksView(paid({ items: [{ lookupKey: "nope", quantity: 1 }] }), CATALOG).ok).toBe(false);
    expect(thanksView(paid({ items: [{ lookupKey: miami.lookupKey, quantity: null }] }), CATALOG).ok).toBe(false);
  });

  it("totalPacks is the sum of every line", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 1, max: 10 }), { minLength: 1, maxLength: 5 }), (qs) => {
        const r = thanksView(paid({ items: qs.map((quantity) => ({ lookupKey: miami.lookupKey, quantity })) }), CATALOG);
        expect(r.ok && r.value.totalPacks).toBe(qs.reduce((a, b) => a + b, 0));
      }),
    );
  });
});

describe("parseSessionId", () => {
  it("accepts Stripe session ids and nothing else", () => {
    expect(parseSessionId("cs_test_a1B2c3")).toBe("cs_test_a1B2c3");
    expect(parseSessionId("cs_live_a1")).toBe("cs_live_a1");
    for (const bad of [undefined, ["cs_test_a"], "", "{CHECKOUT_SESSION_ID}", "cs_test_", "pi_test_1", "cs_test_a/../b"]) {
      expect(parseSessionId(bad)).toBeUndefined();
    }
  });
});

describe("preorderProduct", () => {
  it("is the named sku, or the only product when none is named", () => {
    expect(preorderProduct(CATALOG, miami.sku)).toBe(miami);
    expect(preorderProduct(CATALOG, "nope")).toBeUndefined();
    expect(preorderProduct([miami], undefined)).toBe(miami);
    expect(preorderProduct([miami, { ...miami, sku: "boston-12pk" }], undefined)).toBeUndefined();
  });
});

describe("catalog image", () => {
  it("width and height are the png's own pixels, and the webp exists", () => {
    const png = readFileSync(new URL(`../../../../public${miami.image.png}`, import.meta.url));
    // PNG IHDR: width and height are big-endian u32 at bytes 16 and 20.
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([miami.image.width, miami.image.height]);
    const webp = readFileSync(new URL(`../../../../public${miami.image.webp}`, import.meta.url));
    expect(webp.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });
});

describe("appearance", () => {
  const css = readFileSync(new URL("../../../app/globals.css", import.meta.url), "utf8");
  const token = (name: string) => new RegExp(`--${name}:\\s*([^;]+);`).exec(css)?.[1].trim();
  // "rgb(0 0 0 / 0.55)" and "rgba(0, 0, 0, 0.55)" are the same color.
  const channels = (c: string | undefined) => c?.match(/[\d.]+/g)?.map(Number);

  it("restates globals.css exactly", () => {
    expect(TOKENS.background).toBe(token("background"));
    expect(TOKENS.foreground).toBe(token("foreground"));
    expect(channels(TOKENS.muted)).toEqual(channels(token("muted")));
    expect(channels(TOKENS.hairline)).toEqual(channels(token("hairline")));
    expect(TOKENS.danger).toBe(token("danger"));
    expect(APPEARANCE.variables?.colorText).toBe(token("foreground"));
  });
});
