import type { Stripe } from "@stripe/stripe-js";
import { loadStripe } from "@stripe/stripe-js/pure";

// One Stripe.js load per publishable key per page. The home page starts it while
// idle so /preorder finds Stripe's files in the cache; /preorder starts it as soon
// as its code runs, not after the page has hydrated. A failed load is forgotten,
// so the next caller tries again instead of inheriting the failure.
const loads = new Map<string, Promise<Stripe | null>>();

export const stripeFor = (publishableKey: string): Promise<Stripe | null> => {
  const known = loads.get(publishableKey);
  if (known) return known;
  const load = loadStripe(publishableKey).catch((e: unknown) => {
    loads.delete(publishableKey);
    throw e;
  });
  loads.set(publishableKey, load);
  return load;
};
