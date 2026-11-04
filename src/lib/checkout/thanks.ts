import { productByLookupKey, type Product } from "@/content/catalog";
import type { Result } from "../email";
import type { PaidSessionSummary } from "../orders/stripe";
import { formatMoney } from "../preorder";

// The thanks page shows the buyer's own order, read back from Stripe by session id.
// Anything short of a paid, complete session we can fully name falls back to the
// generic copy: the page never guesses.

// Stripe session ids are cs_test_… or cs_live_… followed by letters, digits, underscores.
export const parseSessionId = (raw: unknown): string | undefined =>
  typeof raw === "string" && /^cs_(test|live)_[A-Za-z0-9_]{1,255}$/.test(raw) ? raw : undefined;

export type ThanksLine = { readonly product: Product; readonly packs: number };

export type ThanksView = {
  readonly lines: readonly ThanksLine[];
  readonly totalPacks: number;
  readonly paid: string;
};

export function thanksView(s: PaidSessionSummary, catalog: readonly Product[]): Result<ThanksView, string> {
  if (s.status !== "complete") return { ok: false, error: `session status ${s.status}` };
  if (s.paymentStatus !== "paid") return { ok: false, error: `payment_status ${s.paymentStatus}` };
  if (s.amountTotal === null || !s.currency) return { ok: false, error: "session has no total" };
  if (s.items.length === 0) return { ok: false, error: "session has no line items" };

  const lines = s.items.map((i) => ({
    product: i.lookupKey ? productByLookupKey(catalog, i.lookupKey) : undefined,
    packs: i.quantity ?? 0,
  }));
  const known = lines.filter((l): l is ThanksLine => l.product !== undefined && l.packs > 0);
  if (known.length !== lines.length) return { ok: false, error: "session has items not in the catalog" };

  return {
    ok: true,
    value: {
      lines: known,
      totalPacks: known.reduce((n, l) => n + l.packs, 0),
      paid: formatMoney(s.amountTotal, s.currency),
    },
  };
}

