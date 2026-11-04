import Link from "next/link";
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

// Pre-order opens /preorder, where the can and the checkout are. A plain link (or,
// once there's a flavor to choose, a GET form) so it works without JavaScript too.
export function PreorderCta() {
  const [only] = CATALOG;
  const label = `${PREORDER.button} · ${formatUsd(PACK_PRICE_CENTS)}`;
  if (CATALOG.length > 1) {
    return (
      <form method="get" action="/preorder/" className="preorder">
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
        <button type="submit" className="preorder-button">
          {label}
        </button>
        <p className="preorder-terms">{TERMS}</p>
      </form>
    );
  }
  return (
    <div className="preorder">
      <p className="preorder-flavor-name">
        {only.name}
        <span>{only.flavor}</span>
      </p>
      <Link href="/preorder/" className="preorder-button">
        {label}
      </Link>
      <p className="preorder-terms">{TERMS}</p>
    </div>
  );
}
