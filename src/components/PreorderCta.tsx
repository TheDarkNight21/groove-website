import { CATALOG } from "@/content/catalog";
import { PREORDER } from "@/content/preorder";
import { formatUsd, packPriceCents } from "@/lib/preorder";

const perCanCents = PREORDER.usdPerCan * 100;
export const PACK_PRICE_CENTS = packPriceCents(PREORDER.cansPerPack, perCanCents);

// The facts in the order a buyer asks them: what, how much, when, what if.
export const TERMS = [
  `${PREORDER.cansPerPack} cans, ${formatUsd(perCanCents)} a can.`,
  PREORDER.charged,
  `Ships ${PREORDER.shipWindow}.`,
  PREORDER.refund,
  PREORDER.region,
].join(" ");

// A plain form: the server opens a Stripe Checkout Session and redirects there, so
// it works without JavaScript. A flavor choice appears only once there is one to make.
export function PreorderCta() {
  const [only] = CATALOG;
  return (
    <form method="post" action="/api/checkout/" className="preorder">
      {CATALOG.length > 1 ? (
        <>
          <label htmlFor="preorder-sku" className="sr-only">
            Flavor
          </label>
          <select id="preorder-sku" name="sku" className="preorder-flavor" defaultValue={only.sku}>
            {CATALOG.map((p) => (
              <option key={p.sku} value={p.sku}>
                {p.name} · {p.flavor}
              </option>
            ))}
          </select>
        </>
      ) : (
        <>
          <input type="hidden" name="sku" value={only.sku} />
          <p className="preorder-flavor-name">
            {only.name}
            <span>{only.flavor}</span>
          </p>
        </>
      )}
      <button type="submit" className="preorder-button">
        {PREORDER.button} · {formatUsd(PACK_PRICE_CENTS)}
      </button>
      <p className="preorder-terms">{TERMS}</p>
    </form>
  );
}
