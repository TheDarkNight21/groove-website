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
