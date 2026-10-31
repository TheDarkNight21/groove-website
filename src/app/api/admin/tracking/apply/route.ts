import { parseShipRequests, shipAll } from "@/lib/orders/fulfill";
import { storeErrorSummary } from "@/lib/orders/store";
import { adminStore, isAdmin, mailer, missingEnvResponse, unauthorized } from "@/lib/orders/server";

// Step two: only the rows confirmed in the preview. Each order is re-checked as it's
// written (it must still be unshipped), then the customer is emailed.
export async function POST(request: Request) {
  if (!(await isAdmin())) return unauthorized();
  const s = adminStore();
  if (!s.ok) return missingEnvResponse(s.error);
  const m = mailer();
  if (!m.ok) return missingEnvResponse(m.error);

  const reqs = parseShipRequests(await request.json().catch(() => null));
  if (!reqs.ok) return Response.json({ error: reqs.error }, { status: 400 });

  const outcomes = await shipAll(reqs.value, { store: s.value.store, ...m.value, now: () => new Date() });
  outcomes.forEach((o) => {
    if (o.kind === "store-failed") console.error(`tracking apply: #${o.orderId} store ${storeErrorSummary(o.error)}`);
    if (o.kind === "email-failed") console.error(`tracking apply: #${o.orderId} email ${o.error.kind === "upstream" ? o.error.status : o.error.kind}`);
    if (o.kind === "not-unshipped") console.error(`tracking apply: #${o.orderId} no longer unshipped`);
  });
  return Response.json({
    outcomes: outcomes.map((o) =>
      o.kind === "store-failed" ? { ...o, error: { kind: o.error.kind } } : o.kind === "email-failed" ? { ...o, error: { kind: o.error.kind } } : o,
    ),
  });
}
