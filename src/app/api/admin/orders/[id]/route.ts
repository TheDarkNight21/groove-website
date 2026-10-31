import { shipOrder } from "@/lib/orders/fulfill";
import { adminStore, isAdmin, mailer, missingEnvResponse, unauthorized } from "@/lib/orders/server";

// The row actions on /admin: mark shipped (optionally with tracking, which emails the
// customer) or cancelled. Both only move an order that is still unshipped.
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return unauthorized();
  const origin = new URL(request.url).origin;
  const back = (note: string) => Response.redirect(`${origin}/admin/?note=${encodeURIComponent(note)}`, 303);

  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id)) return new Response("Bad order id.", { status: 400 });
  const s = adminStore();
  if (!s.ok) return missingEnvResponse(s.error);

  const form = await request.formData();
  const action = form.get("action");
  const text = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
  };

  if (action === "cancel") {
    const r = await s.value.store.markCancelled(id);
    if (!r.ok) return back(`#${id}: couldn’t update (${r.error.kind})`);
    return back(r.value ? `#${id} cancelled` : `#${id} was not unshipped; nothing changed`);
  }
  if (action === "ship") {
    const tracking = text("tracking");
    const m = mailer();
    if (tracking && !m.ok) return missingEnvResponse(m.error);
    const outcome = await shipOrder(
      { orderId: id, tracking, carrier: text("carrier") },
      {
        store: s.value.store,
        send: m.ok ? m.value.send : async () => ({ ok: false, error: { kind: "network" } }),
        from: m.ok ? m.value.from : "",
        now: () => new Date(),
      },
    );
    switch (outcome.kind) {
      case "shipped":
        return back(`#${id} shipped${outcome.emailed ? ", customer emailed" : ""}`);
      case "email-failed":
        return back(`#${id} shipped, but the email failed (${outcome.error.kind})`);
      case "not-unshipped":
        return back(`#${id} was not unshipped; nothing changed`);
      case "store-failed":
        return back(`#${id}: couldn’t update (${outcome.error.kind})`);
    }
  }
  return new Response("Unknown action.", { status: 400 });
}
