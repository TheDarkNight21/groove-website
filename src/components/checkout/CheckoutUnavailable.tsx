import Link from "next/link";

// What /preorder says when it can't take money: missing keys, Stripe unreachable,
// a session that wouldn't open. Plain, and true: no form, no charge.
export const UNAVAILABLE = "Checkout isn’t available right now. Nothing was charged.";

export function CheckoutUnavailable() {
  return (
    <div className="checkout-unavailable" role="status">
      <p>{UNAVAILABLE}</p>
      <Link href="/" className="not-found-link">
        Back to the record →
      </Link>
    </div>
  );
}
