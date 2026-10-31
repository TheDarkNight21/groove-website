"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { ShipOutcome } from "@/lib/orders/fulfill";
import { NO_MATCH_TEXT, REVIEW_TEXT, type MatchedShipment, type Preview } from "@/lib/orders/tracking-import";

type State =
  | { readonly phase: "idle" }
  | { readonly phase: "reading" }
  | { readonly phase: "preview"; readonly preview: Preview; readonly chosen: ReadonlySet<number> }
  | { readonly phase: "applying"; readonly preview: Preview; readonly chosen: ReadonlySet<number> }
  | { readonly phase: "done"; readonly outcomes: readonly ShipOutcome[] }
  | { readonly phase: "failed"; readonly message: string };

const key = (m: MatchedShipment) => m.row.line;

const OUTCOME_TEXT: Record<ShipOutcome["kind"], string> = {
  shipped: "shipped, customer emailed",
  "email-failed": "shipped, but the email failed",
  "not-unshipped": "skipped: no longer unshipped",
  "store-failed": "not saved",
};

async function errorOf(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  return (body as { error?: string } | null)?.error ?? `Request failed (${res.status}).`;
}

function Group({
  title,
  items,
  chosen,
  toggle,
  note,
}: {
  title: string;
  items: readonly (MatchedShipment & { reason?: keyof typeof REVIEW_TEXT })[];
  chosen: ReadonlySet<number>;
  toggle: (line: number) => void;
  note?: (m: MatchedShipment & { reason?: keyof typeof REVIEW_TEXT }) => string;
}) {
  if (items.length === 0) return null;
  return (
    <fieldset className="admin-group">
      <legend className="eyebrow">
        {title} · {items.length}
      </legend>
      {items.map((m) => (
        <label key={key(m)} className="admin-match">
          <input type="checkbox" checked={chosen.has(key(m))} onChange={() => toggle(key(m))} />
          <span>
            #{m.order.id} {m.order.customerName}, {m.order.zip}
            <span className="admin-sub">
              {m.carrier ?? "carrier?"} {m.tracking} · row {m.row.line}
              {note ? ` · ${note(m)}` : ""}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

// Upload → preview (writes nothing) → tick what to apply → apply.
export function TrackingImport() {
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: "idle" });

  async function onPreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ phase: "reading" });
    const res = await fetch("/api/admin/tracking/preview/", { method: "POST", body: new FormData(event.currentTarget) }).catch(() => null);
    if (!res) return setState({ phase: "failed", message: "Couldn’t reach the server." });
    if (!res.ok) return setState({ phase: "failed", message: await errorOf(res) });
    const preview = (await res.json()) as Preview;
    // Exact matches start ticked; anything that needs review starts unticked.
    setState({ phase: "preview", preview, chosen: new Set(preview.ready.map(key)) });
  }

  async function apply(preview: Preview, chosen: ReadonlySet<number>) {
    const shipments = [...preview.ready, ...preview.review]
      .filter((m) => chosen.has(key(m)))
      .map((m) => ({ orderId: m.order.id, tracking: m.tracking, carrier: m.carrier }));
    setState({ phase: "applying", preview, chosen });
    const res = await fetch("/api/admin/tracking/apply/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipments }),
    }).catch(() => null);
    if (!res) return setState({ phase: "failed", message: "Couldn’t reach the server." });
    if (!res.ok) return setState({ phase: "failed", message: await errorOf(res) });
    const { outcomes } = (await res.json()) as { outcomes: ShipOutcome[] };
    setState({ phase: "done", outcomes });
    router.refresh();
  }

  if (state.phase === "preview" || state.phase === "applying") {
    const { preview, chosen } = state;
    const toggle = (line: number) => {
      const next = new Set(chosen);
      if (!next.delete(line)) next.add(line);
      setState({ phase: "preview", preview, chosen: next });
    };
    return (
      <div className="admin-import">
        <Group title="Ready" items={preview.ready} chosen={chosen} toggle={toggle} />
        <Group title="Needs review" items={preview.review} chosen={chosen} toggle={toggle} note={(m) => (m.reason ? REVIEW_TEXT[m.reason] : "")} />
        {preview.noMatch.length > 0 ? (
          <fieldset className="admin-group">
            <legend className="eyebrow">No match · {preview.noMatch.length}</legend>
            {preview.noMatch.map(({ row, reason }) => (
              <p key={row.line} className="admin-match admin-muted">
                Row {row.line}: {row.name ?? row.orderNumber ?? "?"} {row.tracking ?? ""}
                <span className="admin-sub">{NO_MATCH_TEXT[reason]}</span>
              </p>
            ))}
          </fieldset>
        ) : null}
        <div className="admin-row">
          <button
            type="button"
            className="admin-button"
            disabled={chosen.size === 0 || state.phase === "applying"}
            onClick={() => apply(preview, chosen)}
          >
            {state.phase === "applying" ? "Applying…" : `Mark ${chosen.size} shipped and email customers`}
          </button>
          <button type="button" className="admin-button admin-button-quiet" onClick={() => setState({ phase: "idle" })}>
            Start over
          </button>
        </div>
      </div>
    );
  }

  if (state.phase === "done") {
    return (
      <div className="admin-import">
        <ul className="admin-outcomes" role="status">
          {state.outcomes.map((o) => (
            <li key={o.orderId}>
              #{o.orderId} {o.kind === "shipped" && !o.emailed ? "shipped" : OUTCOME_TEXT[o.kind]}
            </li>
          ))}
        </ul>
        <button type="button" className="admin-button admin-button-quiet" onClick={() => setState({ phase: "idle" })}>
          Import another report
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onPreview} className="admin-row">
      <label htmlFor="report" className="sr-only">
        Pirate Ship shipment report
      </label>
      <input id="report" name="report" type="file" accept=".csv,.xlsx" required className="admin-file" />
      <button type="submit" className="admin-button" disabled={state.phase === "reading"}>
        {state.phase === "reading" ? "Reading…" : "Preview tracking import"}
      </button>
      <span className="admin-sub">Pirate Ship shipment report, .csv or .xlsx</span>
      {state.phase === "failed" ? (
        <p role="alert" className="admin-problem">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
