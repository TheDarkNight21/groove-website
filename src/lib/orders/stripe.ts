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

// Where the buyer pays. Hosted: Stripe's own page, reached by a form post, so it
// works without JavaScript. Elements: our /preorder page, with Stripe's fields in it.
export type CheckoutUi =
  | { readonly kind: "hosted"; readonly successUrl: string; readonly cancelUrl: string }
  | { readonly kind: "elements"; readonly returnUrl: string };

export type CheckoutRequest = {
  readonly product: Product;
  readonly maxQuantity: number;
  readonly ui: CheckoutUi;
};

// What the browser needs next: a page to go to, or a secret to mount Elements with.
export type OpenedCheckout =
  | { readonly kind: "hosted"; readonly url: string }
  | { readonly kind: "elements"; readonly clientSecret: string };

const uiParams = (ui: CheckoutUi): Stripe.Checkout.SessionCreateParams => {
  switch (ui.kind) {
    case "hosted":
      return { ui_mode: "hosted_page", success_url: ui.successUrl, cancel_url: ui.cancelUrl };
    case "elements":
      // Elements sessions come back to return_url; success_url and cancel_url aren't allowed.
      return { ui_mode: "elements", return_url: ui.returnUrl };
    default: {
      const never: never = ui;
      return never;
    }
  }
};

// Pure: the Checkout Session we ask Stripe for, minus the price id it resolves.
// No phone number: a box ships without one, and every field is a reason to leave.
export const checkoutParams = (req: CheckoutRequest, priceId: string): Stripe.Checkout.SessionCreateParams => ({
  mode: "payment",
  line_items: [
    {
      price: priceId,
      quantity: 1,
      // Hosted shows its own stepper; Elements sessions need this for updateLineItemQuantity.
      adjustable_quantity: { enabled: true, minimum: 1, maximum: req.maxQuantity },
    },
  ],
  // Card only (wallets are cards): a pre-order ships months out, which buy-now-pay-later terms don't allow.
  allowed_payment_method_types: ["card"],
  shipping_address_collection: { allowed_countries: ["US"] },
  automatic_tax: { enabled: true },
  metadata: { sku: req.product.sku },
  ...uiParams(req.ui),
});

// Pure: the part of a created session the browser needs, or why it's missing.
export const openedFrom = (
  ui: CheckoutUi,
  session: { readonly url: string | null; readonly client_secret: string | null },
): Result<OpenedCheckout, string> => {
  switch (ui.kind) {
    case "hosted":
      return session.url ? { ok: true, value: { kind: "hosted", url: session.url } } : { ok: false, error: "Stripe returned no checkout url" };
    case "elements":
      return session.client_secret
        ? { ok: true, value: { kind: "elements", clientSecret: session.client_secret } }
        : { ok: false, error: "Stripe returned no client secret" };
    default: {
      const never: never = ui;
      return never;
    }
  }
};

export async function openCheckout(stripe: Stripe, req: CheckoutRequest): Promise<Result<OpenedCheckout, string>> {
  try {
    const prices = await stripe.prices.list({ lookup_keys: [req.product.lookupKey], active: true, limit: 1 });
    const price = prices.data[0];
    if (!price) return { ok: false, error: `no active Stripe price with lookup key ${req.product.lookupKey}` };
    const session = await stripe.checkout.sessions.create(checkoutParams(req, price.id));
    return openedFrom(req.ui, session);
  } catch (e) {
    return { ok: false, error: message(e) };
  }
}

// The slice of a finished session the thanks page reads. Nothing personal: the page
// is reachable by anyone holding the session id, so it shows what, how many, how much.
export type PaidSessionSummary = {
  readonly id: string;
  readonly status: string | null;
  readonly paymentStatus: string;
  readonly amountTotal: number | null;
  readonly currency: string | null;
  readonly items: readonly SessionLineItem[];
};

export const sessionSummaryOf =
  (stripe: Stripe) =>
  async (sessionId: string): Promise<Result<PaidSessionSummary, string>> => {
    try {
      const [session, items] = await Promise.all([
        stripe.checkout.sessions.retrieve(sessionId),
        lineItemsOf(stripe)(sessionId),
      ]);
      if (!items.ok) return items;
      return {
        ok: true,
        value: {
          id: session.id,
          status: session.status,
          paymentStatus: session.payment_status,
          amountTotal: session.amount_total,
          currency: session.currency,
          items: items.value,
        },
      };
    } catch (e) {
      return { ok: false, error: message(e) };
    }
  };
