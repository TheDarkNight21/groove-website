import { CATALOG, productBySku } from "@/content/catalog";
import { PREORDER } from "@/content/preorder";
import { env } from "@/lib/orders/server";
import { openCheckout, stripeClient } from "@/lib/orders/stripe";
import { thanksUrl } from "@/lib/preorder";

// The no-JavaScript path: /preorder's <noscript> form posts here, and the buyer is
// sent on to Stripe's hosted checkout.
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

  const opened = await openCheckout(stripeClient(e.value.STRIPE_SECRET_KEY), {
    product,
    maxQuantity: PREORDER.maxPacks,
    ui: {
      kind: "hosted",
      successUrl: thanksUrl(origin, PREORDER.thanks.path),
      cancelUrl: `${origin}/`,
    },
  });
  if (!opened.ok) return fail(opened.error);
  return opened.value.kind === "hosted" ? Response.redirect(opened.value.url, 303) : fail("expected a hosted session");
}
