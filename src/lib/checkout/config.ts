import type { Result } from "../email";

// Whether /preorder can take money right now. Both keys must be set and in the
// same mode: a test publishable key against a live secret (or the reverse) would
// mount a form that can never pay, so it counts as unavailable, not as a page.

export const CHECKOUT_ENV = ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"] as const;
export type CheckoutEnvName = (typeof CHECKOUT_ENV)[number];

// secretKey is server-only: hand the client publishableKey alone, never this object.
export type CheckoutConfig = { readonly secretKey: string; readonly publishableKey: string; readonly mode: KeyMode };

export type ConfigProblem =
  | { readonly kind: "missing"; readonly names: readonly CheckoutEnvName[] }
  | { readonly kind: "unrecognized-key"; readonly name: CheckoutEnvName }
  | { readonly kind: "mode-mismatch" };

export type KeyMode = "test" | "live";

// sk_/rk_ secret or restricted keys, pk_ publishable keys.
export const keyMode = (key: string): KeyMode | undefined => {
  const m = /^(?:sk|rk|pk)_(test|live)_/.exec(key);
  return m ? (m[1] as KeyMode) : undefined;
};

export function checkoutConfig(env: Readonly<Record<string, string | undefined>>): Result<CheckoutConfig, ConfigProblem> {
  const value = (n: CheckoutEnvName) => env[n]?.trim() ?? "";
  const missing = CHECKOUT_ENV.filter((n) => value(n) === "");
  if (missing.length > 0) return { ok: false, error: { kind: "missing", names: missing } };

  const secretKey = value("STRIPE_SECRET_KEY");
  const secret = keyMode(secretKey);
  if (!secret) return { ok: false, error: { kind: "unrecognized-key", name: "STRIPE_SECRET_KEY" } };
  const publishable = value("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
  const pubMode = publishable.startsWith("pk_") ? keyMode(publishable) : undefined;
  if (!pubMode) return { ok: false, error: { kind: "unrecognized-key", name: "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" } };
  if (pubMode !== secret) return { ok: false, error: { kind: "mode-mismatch" } };
  return { ok: true, value: { secretKey, publishableKey: publishable, mode: secret } };
}

// For the server log: names the problem, never a key.
export function describeConfigProblem(p: ConfigProblem): string {
  switch (p.kind) {
    case "missing":
      return `missing env ${p.names.join(", ")}`;
    case "unrecognized-key":
      return `${p.name} is not a Stripe key`;
    case "mode-mismatch":
      return "STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY are in different modes (test vs live)";
    default: {
      const never: never = p;
      return never;
    }
  }
}
