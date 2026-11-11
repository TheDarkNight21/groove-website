import { CATALOG } from "@/content/catalog";
import { analyticsConfig } from "@/lib/analytics/config";
import { captureErrorSummary, captureSender } from "@/lib/analytics/server";
import { env, missingEnvResponse } from "@/lib/orders/server";
import { supabaseOrderStore } from "@/lib/orders/store";
import { lineItemsOf, stripeClient, verifier } from "@/lib/orders/stripe";
import { handleWebhook, webhookErrorSummary, webhookStatus } from "@/lib/orders/webhook";

// Stripe → orders. Point the Stripe endpoint at /api/stripe/webhook/ (trailing slash:
// the site redirects without it, and Stripe does not follow redirects).
export async function POST(request: Request) {
  const e = env(["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SUPABASE_URL", "SUPABASE_SECRET_KEY"]);
  if (!e.ok) return missingEnvResponse(e.error);

  const stripe = stripeClient(e.value.STRIPE_SECRET_KEY);
  // The signature covers the exact bytes Stripe sent, so read the body as text.
  const raw = await request.text();
  const result = await handleWebhook(raw, request.headers.get("stripe-signature"), {
    verify: verifier(stripe, e.value.STRIPE_WEBHOOK_SECRET),
    lineItems: lineItemsOf(stripe),
    store: supabaseOrderStore({ url: e.value.SUPABASE_URL, secretKey: e.value.SUPABASE_SECRET_KEY }),
    catalog: CATALOG,
  });

  // Tell analytics about a newly recorded order. The order is already saved: a failure
  // here is logged and Stripe still hears 200, so analytics can never cost an order.
  if (result.ok && result.value.kind === "recorded") {
    const analytics = analyticsConfig({ key: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN, host: process.env.NEXT_PUBLIC_POSTHOG_HOST });
    if (analytics) {
      const sent = await captureSender(analytics)(result.value.paid, new Date());
      if (!sent.ok) console.error("webhook: order_paid not recorded in analytics:", captureErrorSummary(sent.error));
    }
  }

  if (result.ok) console.info("webhook:", result.value.kind, "reason" in result.value ? result.value.reason : result.value.sessionId);
  else console.error("webhook failed:", webhookErrorSummary(result.error));
  return Response.json(result.ok ? { kind: result.value.kind } : { error: result.error.kind }, { status: webhookStatus(result) });
}
