import type { Result } from "./email";

// A Stripe Payment Link: the only kind of checkout address the hero may point at.
// Live links are https://buy.stripe.com/<id>; test-mode links are https://buy.stripe.com/test_<id>.
export type CheckoutUrl = string & { readonly __brand: "CheckoutUrl" };
export type CheckoutUrlError = "missing" | "not-stripe";

const STRIPE_HOST = "buy.stripe.com";

export const packPriceCents = (cans: number, perCanCents: number): number => cans * perCanCents;

// "$36" when whole, "$36.50" otherwise; thousands grouped.
export function formatUsd(cents: number): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

// Smart constructor: the only way to get a CheckoutUrl.
export function parseCheckoutUrl(raw: unknown): Result<CheckoutUrl, CheckoutUrlError> {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (trimmed === "") return { ok: false, error: "missing" };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: "not-stripe" };
  }
  const isStripe = url.protocol === "https:" && url.host === STRIPE_HOST && url.pathname.length > 1;
  return isStripe ? { ok: true, value: trimmed as CheckoutUrl } : { ok: false, error: "not-stripe" };
}
