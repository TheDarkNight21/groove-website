import { CATALOG, productBySku } from "@/content/catalog";
import { PREORDER } from "@/content/preorder";
import { env } from "@/lib/orders/server";
import { createCheckout, stripeClient } from "@/lib/orders/stripe";

// The hero's form posts here; the buyer is sent on to Stripe's hosted checkout.
// Any failure lands on /checkout-error/ with the reason in the server log.
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const fail = (why: string) => {
    console.error("checkout:", why);
    return Response.redirect(`${origin}/checkout-error/`, 303);
  };

  const e = env(["STRIPE_SECRET_KEY"]);
  if (!e.ok) return fail(`missing env ${e.error.missing.join(", ")}`);

  const form = await request.formData().catch(() => null);
  const sku = form?.get("sku");
  const product = typeof sku === "string" ? productBySku(CATALOG, sku) : undefined;
  if (!product) return fail(`unknown sku ${String(sku)}`);

  const url = await createCheckout(stripeClient(e.value.STRIPE_SECRET_KEY), {
    product,
    maxQuantity: PREORDER.maxPacks,
    successUrl: `${origin}${PREORDER.thanks.path}/?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${origin}/`,
  });
  return url.ok ? Response.redirect(url.value, 303) : fail(url.error);
}
