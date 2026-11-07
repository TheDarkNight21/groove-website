import type { Metadata } from "next";
import Link from "next/link";
import { CanImage } from "@/components/product/CanImage";
import { CATALOG } from "@/content/catalog";
import { PREORDER } from "@/content/preorder";
import { SITE } from "@/content/site";
import { packsLabel } from "@/lib/checkout/summary";
import { parseSessionId, thanksView, type ThanksView } from "@/lib/checkout/thanks";
import type { Result } from "@/lib/email";
import { env } from "@/lib/orders/server";
import { sessionSummaryOf, stripeClient } from "@/lib/orders/stripe";
import { FollowGroove } from "@/components/FollowGroove";

const { thanks } = PREORDER;

// Stripe sends buyers here after checkout. Not for search engines, and it has to
// override the root canonical/OG url or it would claim to be the homepage.
export const metadata: Metadata = {
  title: "Thanks",
  description: thanks.lede,
  robots: { index: false, follow: false },
  alternates: { canonical: thanks.path },
  openGraph: { url: thanks.path, title: `Thanks — ${SITE.name}`, description: thanks.lede },
};

// The edge: the buyer's order, read from Stripe by the session id in the url. Never
// from anything the browser says about itself.
async function readOrder(raw: unknown): Promise<Result<ThanksView, string>> {
  const id = parseSessionId(raw);
  if (!id) return { ok: false, error: "no session id" };
  const e = env(["STRIPE_SECRET_KEY"]);
  if (!e.ok) return { ok: false, error: `missing env ${e.error.missing.join(", ")}` };
  const summary = await sessionSummaryOf(stripeClient(e.value.STRIPE_SECRET_KEY))(id);
  return summary.ok ? thanksView(summary.value, CATALOG) : summary;
}

export default async function Thanks({ searchParams }: PageProps<"/thanks">) {
  const { session_id } = await searchParams;
  const order = await readOrder(session_id);
  if (!order.ok && session_id !== undefined) console.error("thanks: showing generic copy:", order.error);

  return (
    <main className="page">
      <div className="topline">
        <Link href="/" className="wordmark">
          {SITE.name}
        </Link>
        <span className="eyebrow">{thanks.eyebrow}</span>
      </div>
      {order.ok ? (
        <div className="buy">
          <CanImage image={order.value.lines[0].product.image} className="buy-can" eager />
          <section className="buy-panel">
            <h1 className="display">{thanks.title}</h1>
            <ul className="thanks-lines">
              {order.value.lines.map((l) => (
                <li key={l.product.sku}>
                  <span className="buy-name">{l.product.name}</span>
                  <span className="buy-flavor">{l.product.flavor}</span>
                  <span className="buy-price">{packsLabel(l.packs, PREORDER.cansPerPack)}</span>
                </li>
              ))}
            </ul>
            <dl className="checkout-total thanks-total">
              <div>
                <dt>Paid</dt>
                <dd>{order.value.paid}</dd>
              </div>
            </dl>
            <p className="thanks-ships">Ships {PREORDER.shipWindow}.</p>
            <p className="thanks-refund">{PREORDER.refund}</p>
            <FollowGroove label={SITE.watch} className="thanks-follow" />
            <p className="thanks-note">{thanks.lede}</p>
            <Link href="/" className="not-found-link">
              {thanks.back} →
            </Link>
          </section>
        </div>
      ) : (
        <section className="not-found">
          <h1 className="display">{thanks.title}</h1>
          <p className="lede">{thanks.lede}</p>
          <Link href="/" className="not-found-link">
            {thanks.back} →
          </Link>
        </section>
      )}
    </main>
  );
}
