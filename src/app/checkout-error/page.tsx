import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/content/site";

// Where the checkout route sends a buyer when Stripe couldn't open a session.
// No card was charged; the reason is in the server log.
export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
  alternates: { canonical: "/checkout-error" },
};

export default function CheckoutError() {
  return (
    <main className="page">
      <div className="topline">
        <Link href="/" className="wordmark">
          {SITE.name}
        </Link>
        <span className="eyebrow">Pre-order</span>
      </div>
      <section className="not-found">
        <h1 className="display">Checkout didn’t open.</h1>
        <p className="lede">Nothing was charged. Try again in a moment.</p>
        <Link href="/" className="not-found-link">
          Back to the record →
        </Link>
      </section>
    </main>
  );
}
