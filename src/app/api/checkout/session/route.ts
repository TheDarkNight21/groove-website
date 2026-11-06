import { CATALOG, productBySku } from "@/content/catalog";
import { PREORDER } from "@/content/preorder";
import { checkoutConfig, describeConfigProblem } from "@/lib/checkout/config";
import { openCheckout, stripeClient, type PriceIds } from "@/lib/orders/stripe";

// Remembered across requests on a warm instance; see openCheckoutWith.
const priceIds: PriceIds = new Map();
import { thanksUrl } from "@/lib/preorder";

// /preorder asks here for a Checkout Session to mount Stripe's fields on. The answer
// is a client secret, or a status and a reason the page can't take money right now.
// The page shows its own plain message; the details stay in the server log.
export async function POST(request: Request) {
  const fail = (status: number, why: string) => {
    console.error("checkout session:", why);
    return Response.json({ error: "unavailable" }, { status });
  };

  const config = checkoutConfig(process.env);
  if (!config.ok) return fail(503, describeConfigProblem(config.error));

  const body: unknown = await request.json().catch(() => null);
  const sku = body && typeof body === "object" && "sku" in body ? body.sku : undefined;
  const product = typeof sku === "string" ? productBySku(CATALOG, sku) : undefined;
  if (!product) return fail(400, `unknown sku ${String(sku)}`);

  const origin = new URL(request.url).origin;
  const opened = await openCheckout(stripeClient(config.value.secretKey), {
    product,
    maxQuantity: PREORDER.maxPacks,
    ui: { kind: "elements", returnUrl: thanksUrl(origin, PREORDER.thanks.path) },
  }, priceIds);
  if (!opened.ok) return fail(502, opened.error);
  if (opened.value.kind !== "elements") return fail(502, "expected an elements session");
  // The secret only goes to the page that mounts it; never logged, never in a URL.
  return Response.json({ clientSecret: opened.value.clientSecret }, { headers: { "Cache-Control": "no-store" } });
}
