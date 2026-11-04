export const packPriceCents = (cans: number, perCanCents: number): number => cans * perCanCents;

// "$36" when whole, "$36.50" otherwise; thousands grouped. Two-decimal currencies only.
export function formatMoney(cents: number, currency: string): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export const formatUsd = (cents: number): string => formatMoney(cents, "usd");

// Where Stripe sends a buyer after paying. Stripe fills in {CHECKOUT_SESSION_ID};
// the thanks page reads that session back to show the order.
export const thanksUrl = (origin: string, thanksPath: string): string =>
  `${origin}${thanksPath}/?session_id={CHECKOUT_SESSION_ID}`;
