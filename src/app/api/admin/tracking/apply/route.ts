import { parseShipRequests, shipAll } from "@/lib/orders/fulfill";
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
  outcomes.filter((o) => o.kind !== "shipped").forEach((o) => console.error("tracking apply:", JSON.stringify(o)));
  return Response.json({ outcomes });
}
