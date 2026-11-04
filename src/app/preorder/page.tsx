import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { CheckoutUnavailable } from "@/components/checkout/CheckoutUnavailable";
import { PreorderCheckout } from "@/components/checkout/PreorderCheckout";
import { ProductGallery } from "@/components/product/ProductGallery";
import { CATALOG } from "@/content/catalog";
import { PREORDER, PREORDER_PROMISE, PREORDER_REASSURANCE } from "@/content/preorder";
import { SITE } from "@/content/site";
import { checkoutConfig, describeConfigProblem } from "@/lib/checkout/config";
import { preorderProduct } from "@/lib/checkout/product";
import { formatUsd, packPriceCents } from "@/lib/preorder";

export const metadata: Metadata = {
  title: "Pre-order",
  description: `${PREORDER.cansPerPack} cans. ${PREORDER_PROMISE}`,
  alternates: { canonical: "/preorder" },
  openGraph: { url: "/preorder" },
};

const perCanCents = PREORDER.usdPerCan * 100;

// The photos first, then the checkout. Keys are read per request, so a missing one
// shows the unavailable state rather than a page frozen at build time.
export default async function Preorder({ searchParams }: PageProps<"/preorder">) {
  await connection();
  const { sku } = await searchParams;
  const product = preorderProduct(CATALOG, sku);
  const config = checkoutConfig(process.env);
  if (!config.ok) console.error("preorder:", describeConfigProblem(config.error));

  return (
    <main className="page">
      <div className="topline">
        <Link href="/" className="wordmark">
          {SITE.name}
        </Link>
      </div>
      {product ? (
        <div className="buy">
          <ProductGallery images={product.images} name={product.name} />
          <div className="buy-panel">
            <h1 className="buy-name">{product.name}</h1>
            <p className="buy-flavor">
              <span className="flavor-marker" style={{ backgroundColor: product.accent }} aria-hidden="true" />
              {product.flavor}
            </p>
            <p className="buy-what">{PREORDER.what}</p>
            <p className="buy-promise">{PREORDER_REASSURANCE}</p>
            {config.ok ? (
              <>
                <PreorderCheckout publishableKey={config.value.publishableKey} sku={product.sku} />
                {/* Without JavaScript, Stripe's own page takes the order. */}
                <noscript>
                  <form method="post" action="/api/checkout/" className="preorder checkout-noscript">
                    <input type="hidden" name="sku" value={product.sku} />
                    <button type="submit" className="preorder-button">
                      {PREORDER.button} · {formatUsd(packPriceCents(PREORDER.cansPerPack, perCanCents))}
                    </button>
                    <p className="preorder-terms">{PREORDER_PROMISE}</p>
                  </form>
                </noscript>
              </>
            ) : (
              <CheckoutUnavailable />
            )}
          </div>
        </div>
      ) : (
        <section className="not-found">
          <h1 className="display">That flavor isn’t on sale.</h1>
          <Link href="/" className="not-found-link">
            Back to the record →
          </Link>
        </section>
      )}
    </main>
  );
}
