import { exportFilename, unshippedCsv } from "@/lib/orders/export";
import { adminStore, isAdmin, missingEnvResponse, unauthorized } from "@/lib/orders/server";

// "Download unshipped orders": the CSV Pirate Ship imports.
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const s = adminStore();
  if (!s.ok) return missingEnvResponse(s.error);

  const orders = await s.value.store.list({ livemode: s.value.livemode, status: "unshipped" });
  if (!orders.ok) {
    console.error("export: store failed", JSON.stringify(orders.error));
    return new Response("Couldn’t read orders.", { status: 502 });
  }
  return new Response(unshippedCsv([...orders.value].reverse()), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${exportFilename(new Date())}"`,
      "Cache-Control": "no-store",
    },
  });
}
