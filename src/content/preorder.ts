// Pre-order facts and copy. The price on the page is computed from cansPerPack and
// usdPerCan, so it can never drift from the figures here; the Stripe price must match.

export const PREORDER = {
  name: "Groove 12-pack",
  cansPerPack: 12,
  usdPerCan: 3,
  shipWindow: "by December 2026",
  refund: "Full refund any time before it ships.",
  region: "Ships in the US.",
  maxPacks: 10,
  button: "Pre-order",
  // What it is, under the flavor name on /preorder: the can says it in 9pt, the page
  // should say it too.
  what: "Sparkling energy for the flow state. 120 mg caffeine.",
  charged: "Charged today.",
  waitlistLink: "Not ready to order? Join the waitlist",
  thanks: {
    path: "/thanks",
    eyebrow: "Pre-order",
    title: "Order received.",
    lede: "We’ll email you when it ships. Your receipt is on its way from Stripe.",
    back: "Back to the record",
  },
} as const;

// The promise under every pay button, in the order a buyer worries: when am I
// charged, when does it come, what if I change my mind.
export const PREORDER_PROMISE = `${PREORDER.charged} Ships ${PREORDER.shipWindow}. ${PREORDER.refund}`;

// Above the checkout, where the worry starts: the risk-free part first.
export const PREORDER_REASSURANCE = `${PREORDER.refund} Ships ${PREORDER.shipWindow}.`;
