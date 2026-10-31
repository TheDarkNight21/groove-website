import type { Result } from "../email";

// Server-only configuration. Each route asks for exactly the variables it uses and
// gets all the missing ones back at once, never a half-configured run.
export const SERVER_ENV = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "ADMIN_TOKEN",
  "RESEND_API_KEY",
  "ORDERS_EMAIL_FROM",
] as const;

export type ServerEnvName = (typeof SERVER_ENV)[number];

export type MissingEnv = { readonly missing: readonly ServerEnvName[] };

export function readEnv<const N extends ServerEnvName>(
  env: Readonly<Record<string, string | undefined>>,
  names: readonly N[],
): Result<Readonly<Record<N, string>>, MissingEnv> {
  const missing = names.filter((n) => !env[n]?.trim());
  if (missing.length > 0) return { ok: false, error: { missing } };
  return { ok: true, value: Object.fromEntries(names.map((n) => [n, env[n]!.trim()])) as Record<N, string> };
}

// Admin views show the orders of the mode the Stripe key is in, so test orders can
// never reach a live shipping export and live ones never show up in local testing.
export const isLiveKey = (stripeSecretKey: string): boolean =>
  stripeSecretKey.startsWith("sk_live_") || stripeSecretKey.startsWith("rk_live_");
