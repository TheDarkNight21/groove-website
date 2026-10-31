import { readReportFile, MAX_REPORT_BYTES } from "@/lib/orders/report-file";
import { adminStore, isAdmin, missingEnvResponse, unauthorized } from "@/lib/orders/server";
import { matchShipments, readReport } from "@/lib/orders/tracking-import";

// Step one of the tracking import: read the Pirate Ship report and say what would
// happen. Writes nothing.
export async function POST(request: Request) {
  if (!(await isAdmin())) return unauthorized();
  const s = adminStore();
  if (!s.ok) return missingEnvResponse(s.error);

  const form = await request.formData().catch(() => null);
  const file = form?.get("report");
  if (!(file instanceof File)) return Response.json({ error: "Choose a .csv or .xlsx file." }, { status: 400 });
  if (file.size > MAX_REPORT_BYTES) return Response.json({ error: "That file is over 4 MB." }, { status: 413 });

  const table = await readReportFile(file.name, Buffer.from(await file.arrayBuffer()));
  if (!table.ok) {
    const msg = table.error.kind === "unsupported" ? "Only .csv and .xlsx files." : `Couldn’t read the file: ${table.error.detail}`;
    return Response.json({ error: msg }, { status: 400 });
  }
  const rows = readReport(table.value);
  if (!rows.ok) {
    const msg =
      rows.error.kind === "empty"
        ? "The file is empty."
        : `Missing columns: need ${rows.error.need}. Found: ${rows.error.found.join(", ") || "none"}.`;
    return Response.json({ error: msg }, { status: 400 });
  }

  const orders = await s.value.store.list({ livemode: s.value.livemode });
  if (!orders.ok) return Response.json({ error: "Couldn’t read orders." }, { status: 502 });
  return Response.json(matchShipments(rows.value, orders.value));
}
