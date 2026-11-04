import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { CATALOG } from "@/content/catalog";
import { checkoutParams, openedFrom, type CheckoutUi } from "../stripe";

const product = CATALOG[0];
const hosted: CheckoutUi = { kind: "hosted", successUrl: "https://x.test/thanks/", cancelUrl: "https://x.test/" };
const elements: CheckoutUi = { kind: "elements", returnUrl: "https://x.test/thanks/?session_id={CHECKOUT_SESSION_ID}" };

const anyUi: fc.Arbitrary<CheckoutUi> = fc.oneof(
  fc.record({ kind: fc.constant("hosted" as const), successUrl: fc.webUrl(), cancelUrl: fc.webUrl() }),
  fc.record({ kind: fc.constant("elements" as const), returnUrl: fc.webUrl() }),
);

describe("checkoutParams", () => {
  it("hosted: Stripe's page, success and cancel urls, no return url", () => {
    const p = checkoutParams({ product, maxQuantity: 10, ui: hosted }, "price_1");
    expect(p.ui_mode).toBe("hosted_page");
    expect(p.success_url).toBe("https://x.test/thanks/");
    expect(p.cancel_url).toBe("https://x.test/");
    expect(p).not.toHaveProperty("return_url");
  });

  it("elements: our page, a return url, and none of the hosted-only urls", () => {
    const p = checkoutParams({ product, maxQuantity: 10, ui: elements }, "price_1");
    expect(p.ui_mode).toBe("elements");
    expect(p.return_url).toBe("https://x.test/thanks/?session_id={CHECKOUT_SESSION_ID}");
    expect(p).not.toHaveProperty("success_url");
    expect(p).not.toHaveProperty("cancel_url");
  });

  it("both modes sell the same thing the same way: card only, US shipping, tax, the sku, no phone", () => {
    fc.assert(
      fc.property(anyUi, fc.integer({ min: 1, max: 99 }), fc.string({ minLength: 1 }), (ui, max, priceId) => {
        const p = checkoutParams({ product, maxQuantity: max, ui }, priceId);
        expect(p.mode).toBe("payment");
        expect(p.line_items).toEqual([
          { price: priceId, quantity: 1, adjustable_quantity: { enabled: true, minimum: 1, maximum: max } },
        ]);
        expect(p.allowed_payment_method_types).toEqual(["card"]);
        expect(p.shipping_address_collection).toEqual({ allowed_countries: ["US"] });
        expect(p.automatic_tax).toEqual({ enabled: true });
        expect(p.metadata).toEqual({ sku: product.sku });
        expect(p).not.toHaveProperty("phone_number_collection");
        // after_expiration (recovery emails) isn't allowed with elements; we don't ask in either mode.
        expect(p).not.toHaveProperty("after_expiration");
      }),
    );
  });
});

describe("openedFrom", () => {
  it("hosted needs a url; elements needs a client secret", () => {
    expect(openedFrom(hosted, { url: "https://checkout.stripe.com/c", client_secret: null })).toEqual({
      ok: true,
      value: { kind: "hosted", url: "https://checkout.stripe.com/c" },
    });
    expect(openedFrom(elements, { url: null, client_secret: "cs_secret" })).toEqual({
      ok: true,
      value: { kind: "elements", clientSecret: "cs_secret" },
    });
    expect(openedFrom(hosted, { url: null, client_secret: "cs_secret" }).ok).toBe(false);
    expect(openedFrom(elements, { url: "https://checkout.stripe.com/c", client_secret: null }).ok).toBe(false);
  });

  it("the opened kind always matches the requested ui", () => {
    fc.assert(
      fc.property(anyUi, fc.webUrl(), fc.string({ minLength: 1 }), (ui, url, secret) => {
        const r = openedFrom(ui, { url, client_secret: secret });
        expect(r.ok && r.value.kind).toBe(ui.kind);
      }),
    );
  });
});
