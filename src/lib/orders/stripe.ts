import Stripe from "stripe";
import type { Product } from "@/content/catalog";
import { visitorMetadata, type VisitorIds } from "@/lib/analytics/events";
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
  // The browser that opened the checkout, when it is being recorded: lets the paid
  // order be tied to the visit. Absent for the no-JavaScript form.
  readonly visitor?: VisitorIds;
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
  // No Link: its "save my info" signup asks for a phone number, the field we dropped.
  wallet_options: { link: { display: "never" } },
  shipping_address_collection: { allowed_countries: ["US"] },
  automatic_tax: { enabled: true },
  metadata: { sku: req.product.sku, ...visitorMetadata(req.visitor) },
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

// The two Stripe calls opening a checkout needs, as a capability, so the
// open-and-cache logic below runs against an in-memory stand-in in tests.
export type CheckoutApi = {
  readonly findPriceId: (lookupKey: string) => Promise<string | undefined>;
  readonly createSession: (
    params: Stripe.Checkout.SessionCreateParams,
  ) => Promise<{ readonly url: string | null; readonly client_secret: string | null }>;
};

export const checkoutApi = (stripe: Stripe): CheckoutApi => ({
  findPriceId: async (lookupKey) =>
    (await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 })).data[0]?.id,
  createSession: (params) => stripe.checkout.sessions.create(params),
});

// Lookup key → price id, remembered for the life of a warm server instance so a
// checkout costs one Stripe call, not two. Owned by the route that passes it in.
export type PriceIds = Map<string, string>;

// Opens a session with the remembered price id. If Stripe refuses it (the price was
// archived or replaced since), the entry is dropped and the price is looked up again
// once, so a stale cache costs one slow checkout, never a failed one.
export const openCheckoutWith =
  (api: CheckoutApi, priceIds: PriceIds) =>
  async (req: CheckoutRequest): Promise<Result<OpenedCheckout, string>> => {
    const key = req.product.lookupKey;
    const lookUp = async (): Promise<Result<string, string>> => {
      const id = await api.findPriceId(key);
      if (!id) return { ok: false, error: `no active Stripe price with lookup key ${key}` };
      priceIds.set(key, id);
      return { ok: true, value: id };
    };
    const open = async (priceId: string) => openedFrom(req.ui, await api.createSession(checkoutParams(req, priceId)));
    try {
      const remembered = priceIds.get(key);
      if (remembered !== undefined) {
        try {
          return await open(remembered);
        } catch {
          priceIds.delete(key);
        }
      }
      const priceId = await lookUp();
      return priceId.ok ? await open(priceId.value) : priceId;
    } catch (e) {
      return { ok: false, error: message(e) };
    }
  };

export const openCheckout = (
  stripe: Stripe,
  req: CheckoutRequest,
  priceIds: PriceIds = new Map(),
): Promise<Result<OpenedCheckout, string>> => openCheckoutWith(checkoutApi(stripe), priceIds)(req);

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
