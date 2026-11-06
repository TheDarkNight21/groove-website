"use client";

import { useEffect } from "react";
import { stripeFor } from "@/lib/checkout/stripe-loader";

// Loads Stripe.js once the page is idle, so by the time a buyer taps Pre-order
// its files are already cached and /preorder's checkout opens without waiting
// for them. Renders nothing; a failure here only means /preorder loads it itself.
const IDLE_FALLBACK_MS = 2000;

export function WarmStripe({ publishableKey }: { publishableKey: string }) {
  useEffect(() => {
    const warm = () => {
      stripeFor(publishableKey).catch(() => {});
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(warm, { timeout: IDLE_FALLBACK_MS });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(warm, IDLE_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [publishableKey]);
  return null;
}
