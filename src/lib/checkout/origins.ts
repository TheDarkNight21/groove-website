// The other origins /preorder's checkout talks to before the buyer can type:
// Stripe.js and its iframes, Stripe's API (the session's /ini), and the font the
// fields are set in (appearance.ts). Connecting to them while the HTML is still
// arriving takes the DNS, TCP and TLS round trips off the path to the form.
export const CHECKOUT_ORIGINS = [
  { href: "https://js.stripe.com" },
  { href: "https://api.stripe.com" },
  { href: "https://fonts.googleapis.com" },
  { href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
] as const;

// The exact script stripe-js injects (dist/pure.js: ORIGIN/RELEASE_TRAIN/stripe.js,
// no query string with fraud signals left on). /preorder preloads it from <head>, so
// it downloads with the HTML instead of after hydration; the injected tag then
// finds it in the cache. origins.test.ts fails if a stripe-js upgrade moves it.
export const STRIPE_JS_URL = "https://js.stripe.com/endive/stripe.js";
