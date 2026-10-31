import Stripe from "stripe";
import type { Product } from "@/content/catalog";
import type { Result } from "../email";
import type { SessionLineItem } from "./order";
import type { StripeEvent } from "./webhook";

// The only module that talks to the Stripe SDK. Exceptions become values here.

const message = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export const stripeClient = (secretKey: string): Stripe => new Stripe(secretKey);

export const verifier =
  (stripe: Stripe, webhookSecret: string) =>
  (rawBody: string, signature: string): Result<StripeEvent, string> => {
    try {
      return { ok: true, value: stripe.webhooks.constructEvent(rawBody, signature, webhookSecret) as StripeEvent };
    } catch (e) {
      return { ok: false, error: message(e) };
    }
  };

export const lineItemsOf =
  (stripe: Stripe) =>
  async (sessionId: string): Promise<Result<readonly SessionLineItem[], string>> => {
    try {
      // A pack order is a handful of lines; 100 is Stripe's page maximum.
      const page = await stripe.checkout.sessions.listLineItems(sessionId, { limit: 100 });
      if (page.has_more) return { ok: false, error: `session ${sessionId} has more than 100 line items` };
      return {
        ok: true,
        value: page.data.map((li) => ({ lookupKey: li.price?.lookup_key ?? null, quantity: li.quantity })),
      };
    } catch (e) {
      return { ok: false, error: message(e) };
    }
  };

export type CheckoutRequest = {
  readonly product: Product;
  readonly maxQuantity: number;
  readonly successUrl: string;
  readonly cancelUrl: string;
};

// Pure: the Checkout Session we ask Stripe for, minus the price id it resolves.
export const checkoutParams = (req: CheckoutRequest, priceId: string): Stripe.Checkout.SessionCreateParams => ({
  mode: "payment",
  line_items: [
    {
      price: priceId,
      quantity: 1,
      adjustable_quantity: { enabled: true, minimum: 1, maximum: req.maxQuantity },
    },
  ],
  // Card only: a pre-order ships months out, which buy-now-pay-later terms don't allow.
  allowed_payment_method_types: ["card"],
  shipping_address_collection: { allowed_countries: ["US"] },
  phone_number_collection: { enabled: true },
  automatic_tax: { enabled: true },
  success_url: req.successUrl,
  cancel_url: req.cancelUrl,
  metadata: { sku: req.product.sku },
});

export async function createCheckout(stripe: Stripe, req: CheckoutRequest): Promise<Result<string, string>> {
  try {
    const prices = await stripe.prices.list({ lookup_keys: [req.product.lookupKey], active: true, limit: 1 });
    const price = prices.data[0];
    if (!price) return { ok: false, error: `no active Stripe price with lookup key ${req.product.lookupKey}` };
    const session = await stripe.checkout.sessions.create(checkoutParams(req, price.id));
    return session.url ? { ok: true, value: session.url } : { ok: false, error: "Stripe returned no checkout url" };
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}
