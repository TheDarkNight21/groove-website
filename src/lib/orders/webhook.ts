import type { Product } from "@/content/catalog";
import type { Result } from "../email";
import { describeOrderError, orderFromSession, type SessionInput, type SessionLineItem } from "./order";
import { storeErrorSummary, type OrderStore, type StoreError } from "./store";

// What the webhook needs from Stripe, as capabilities. The real ones wrap the SDK
// (see stripe.ts); tests pass the SDK's own signer with an in-memory store.
export type WebhookDeps = {
  // Verifies the Stripe-Signature header against the raw body and returns the parsed event.
  readonly verify: (rawBody: string, signature: string) => Result<StripeEvent, string>;
  readonly lineItems: (sessionId: string) => Promise<Result<readonly SessionLineItem[], string>>;
  readonly store: OrderStore;
  readonly catalog: readonly Product[];
};

export type StripeEvent = { readonly id: string; readonly type: string; readonly data: { readonly object: unknown } };

export type WebhookOutcome =
  | { readonly kind: "recorded"; readonly sessionId: string }
  | { readonly kind: "duplicate"; readonly sessionId: string }
  | { readonly kind: "ignored"; readonly reason: string };

export type WebhookError =
  | { readonly kind: "bad-signature"; readonly detail: string }
  | { readonly kind: "stripe"; readonly detail: string }
  | { readonly kind: "bad-order"; readonly detail: string }
  | { readonly kind: "store"; readonly error: StoreError };

// 400 for a forged or garbled request (Stripe won't fix it by retrying); 500 for
// everything else, so Stripe keeps retrying for three days while it's fixed.
export const webhookStatus = (r: Result<WebhookOutcome, WebhookError>): number =>
  r.ok ? 200 : r.error.kind === "bad-signature" ? 400 : 500;

export async function handleWebhook(
  rawBody: string,
  signature: string | null,
  deps: WebhookDeps,
): Promise<Result<WebhookOutcome, WebhookError>> {
  if (!signature) return { ok: false, error: { kind: "bad-signature", detail: "no Stripe-Signature header" } };
  const event = deps.verify(rawBody, signature);
  if (!event.ok) return { ok: false, error: { kind: "bad-signature", detail: event.error } };
  if (event.value.type !== "checkout.session.completed") {
    return { ok: true, value: { kind: "ignored", reason: `event type ${event.value.type}` } };
  }

  const session = event.value.data.object as SessionInput;
  if (session.payment_status !== "paid") {
    // Card-only checkout is paid at completion; anything else isn't an order yet.
    return { ok: true, value: { kind: "ignored", reason: `payment_status ${session.payment_status}` } };
  }

  const items = await deps.lineItems(session.id);
  if (!items.ok) return { ok: false, error: { kind: "stripe", detail: items.error } };

  const order = orderFromSession(session, items.value, deps.catalog);
  if (!order.ok) return { ok: false, error: { kind: "bad-order", detail: describeOrderError(order.error) } };

  const saved = await deps.store.insert(order.value);
  if (!saved.ok) return { ok: false, error: { kind: "store", error: saved.error } };
  return {
    ok: true,
    value: saved.value.inserted
      ? { kind: "recorded", sessionId: session.id }
      : { kind: "duplicate", sessionId: session.id },
  };
}

// One log line per failure with no customer data: Stripe's own messages and our
// order errors name fields, never their values; store errors drop the body.
export const webhookErrorSummary = (e: WebhookError): string =>
  e.kind === "store" ? `store: ${storeErrorSummary(e.error)}` : `${e.kind}: ${e.detail}`;
