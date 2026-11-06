import { describe, expect, it } from "vitest";
import { CATALOG } from "@/content/catalog";
import { openCheckoutWith, type CheckoutApi, type CheckoutRequest, type PriceIds } from "../stripe";

const product = CATALOG[0];
const req: CheckoutRequest = { product, maxQuantity: 10, ui: { kind: "elements", returnUrl: "https://x.test/thanks/" } };

// An in-memory Stripe: `live` is the price id the lookup key resolves to now; a
// session for any other price id is refused, as Stripe refuses an archived price.
const fakeStripe = (initial: string | undefined) => {
  const calls = { find: 0, create: [] as string[] };
  let live = initial;
  const api: CheckoutApi = {
    findPriceId: async () => {
      calls.find += 1;
      return live;
    },
    createSession: async (params) => {
      const price = String(params.line_items?.[0]?.price);
      calls.create.push(price);
      if (price !== live) throw new Error(`No such price: '${price}'`);
      return { url: null, client_secret: `cs_secret_for_${price}` };
    },
  };
  return { api, calls, archiveAndReplace: (next: string) => (live = next) };
};

describe("openCheckoutWith", () => {
  it("looks the price up once, then opens later sessions with one Stripe call", async () => {
    const s = fakeStripe("price_a");
    const priceIds: PriceIds = new Map();
    const open = openCheckoutWith(s.api, priceIds);

    expect(await open(req)).toEqual({ ok: true, value: { kind: "elements", clientSecret: "cs_secret_for_price_a" } });
    expect(await open(req)).toEqual({ ok: true, value: { kind: "elements", clientSecret: "cs_secret_for_price_a" } });
    expect(s.calls.find).toBe(1);
    expect(s.calls.create).toEqual(["price_a", "price_a"]);
    expect(priceIds.get(product.lookupKey)).toBe("price_a");
  });

  it("a remembered price that Stripe no longer takes is looked up again, and the checkout still opens", async () => {
    const s = fakeStripe("price_a");
    const priceIds: PriceIds = new Map([[product.lookupKey, "price_a"]]);
    s.archiveAndReplace("price_b");

    const r = await openCheckoutWith(s.api, priceIds)(req);
    expect(r).toEqual({ ok: true, value: { kind: "elements", clientSecret: "cs_secret_for_price_b" } });
    expect(s.calls.create).toEqual(["price_a", "price_b"]);
    expect(priceIds.get(product.lookupKey)).toBe("price_b");
  });

  it("no active price is an error value, and nothing is remembered", async () => {
    const s = fakeStripe(undefined);
    const priceIds: PriceIds = new Map();
    const r = await openCheckoutWith(s.api, priceIds)(req);
    expect(r).toEqual({ ok: false, error: `no active Stripe price with lookup key ${product.lookupKey}` });
    expect(s.calls.create).toEqual([]);
    expect(priceIds.size).toBe(0);
  });

  it("a Stripe failure on the first lookup comes back as a value, not a throw", async () => {
    const api: CheckoutApi = {
      findPriceId: async () => {
        throw new Error("Stripe is down");
      },
      createSession: async () => ({ url: null, client_secret: null }),
    };
    expect(await openCheckoutWith(api, new Map())(req)).toEqual({ ok: false, error: "Stripe is down" });
  });
});
