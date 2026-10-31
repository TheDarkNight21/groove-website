import { cookies } from "next/headers";
import type { Result } from "../email";
import { ADMIN_COOKIE, isAdminSession } from "./admin-auth";
import { isLiveKey, readEnv, type MissingEnv, type ServerEnvName } from "./env";
import { resendSender } from "./shipping-email";
import { supabaseOrderStore, type OrderStore } from "./store";

// The edge: reads process.env and picks the real capabilities. Routes call these;
// nothing below lib/orders reads the environment itself.

export const env = <const N extends ServerEnvName>(names: readonly N[]) => readEnv(process.env, names);

export const missingEnvResponse = (e: MissingEnv): Response => {
  console.error("orders: missing env", e.missing.join(", "));
  return new Response(`Not configured: set ${e.missing.join(", ")}.`, { status: 503 });
};

export function adminStore(): Result<{ store: OrderStore; livemode: boolean }, MissingEnv> {
  const e = env(["SUPABASE_URL", "SUPABASE_SECRET_KEY", "STRIPE_SECRET_KEY"]);
  if (!e.ok) return e;
  return {
    ok: true,
    value: {
      store: supabaseOrderStore({ url: e.value.SUPABASE_URL, secretKey: e.value.SUPABASE_SECRET_KEY }),
      livemode: isLiveKey(e.value.STRIPE_SECRET_KEY),
    },
  };
}

export function mailer() {
  const e = env(["RESEND_API_KEY", "ORDERS_EMAIL_FROM"]);
  if (!e.ok) return e;
  return { ok: true as const, value: { send: resendSender(e.value.RESEND_API_KEY), from: e.value.ORDERS_EMAIL_FROM } };
}

// Every admin page and route checks this itself; there is no proxy to forget.
export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return isAdminSession(process.env.ADMIN_TOKEN?.trim(), jar.get(ADMIN_COOKIE)?.value);
}

export const unauthorized = (): Response => new Response("Not signed in.", { status: 401 });
