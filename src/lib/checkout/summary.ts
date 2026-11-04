import { formatMoney } from "../preorder";
import { boundsOf, type PackBounds } from "./quantity";

// What /preorder shows about the order, derived only from the live Checkout Session.
// The price on the button is the session's total, so it is the price the buyer pays.

type Amount = { readonly minorUnitsAmount: number; readonly amount: string };

// The slice of Stripe.js's StripeCheckoutSession this reads; tests build it by hand.
export type SessionForSummary = {
  readonly currency: string;
  readonly minorUnitsAmountDivisor: number;
  readonly lineItems: readonly {
    readonly id: string;
    readonly quantity: number;
    readonly adjustableQuantity: { readonly minimum: number; readonly maximum: number } | null;
  }[];
  readonly total: { readonly total: Amount; readonly taxExclusive: Amount; readonly taxInclusive: Amount };
};

export type PackLine = { readonly id: string; readonly packs: number; readonly bounds: PackBounds | undefined };

export type TaxLine = { readonly label: string; readonly amount: string };

export type OrderSummaryView = {
  // The one line this page sells; undefined if the session isn't shaped that way.
  readonly line: PackLine | undefined;
  readonly total: string;
  readonly tax: TaxLine | undefined;
};

// "$36" in the site's style when the currency has cents; Stripe's own text otherwise.
const money = (a: Amount, s: SessionForSummary): string =>
  s.minorUnitsAmountDivisor === 100 ? formatMoney(a.minorUnitsAmount, s.currency) : a.amount;

export function orderSummary(s: SessionForSummary): OrderSummaryView {
  const [only, ...rest] = s.lineItems;
  const line =
    only && rest.length === 0 ? { id: only.id, packs: only.quantity, bounds: boundsOf(only.adjustableQuantity) } : undefined;
  const { taxExclusive, taxInclusive } = s.total;
  const tax =
    taxExclusive.minorUnitsAmount > 0
      ? { label: "Tax", amount: money(taxExclusive, s) }
      : taxInclusive.minorUnitsAmount > 0
        ? { label: "Includes tax", amount: money(taxInclusive, s) }
        : undefined;
  return { line, total: money(s.total.total, s), tax };
}

export const payLabel = (button: string, total: string): string => `${button} · ${total}`;

export const packsLabel = (packs: number, cansPerPack: number): string =>
  `${packs} ${packs === 1 ? "pack" : "packs"} · ${packs * cansPerPack} cans`;
