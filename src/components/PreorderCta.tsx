import { PREORDER } from "@/content/preorder";
import { formatUsd, packPriceCents, type CheckoutUrl } from "@/lib/preorder";

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

type Props = { readonly checkoutUrl: CheckoutUrl };

// A plain link: Stripe hosts the checkout, so nothing here runs in the browser.
export function PreorderCta({ checkoutUrl }: Props) {
  return (
    <div className="preorder">
      <a href={checkoutUrl} className="preorder-button">
        {PREORDER.button} · {formatUsd(PACK_PRICE_CENTS)}
      </a>
      <p className="preorder-terms">{TERMS}</p>
    </div>
  );
}
