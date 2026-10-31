import type { Metadata } from "next";
import { TrackingImport } from "@/components/admin/TrackingImport";
import { SITE } from "@/content/site";
import { formatUsd } from "@/lib/preorder";
import { itemsSummary, isOrderStatus, ORDER_STATUSES, type Order } from "@/lib/orders/order";
import { adminStore, isAdmin } from "@/lib/orders/server";

export const metadata: Metadata = {
  title: "Orders",
  robots: { index: false, follow: false },
};

type Search = { status?: string; note?: string; error?: string };

const date = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Detroit" }).format(new Date(iso));

function SignIn({ failed }: { failed: boolean }) {
  return (
    <section className="admin-signin">
      <h1 className="display">Orders</h1>
      <form method="post" action="/api/admin/login/" className="waitlist-field">
        <label htmlFor="admin-token" className="sr-only">
          Admin token
        </label>
        <input id="admin-token" name="token" type="password" autoComplete="current-password" placeholder="Admin token" className="waitlist-input" />
        <button type="submit" className="waitlist-button">
          Sign in
        </button>
      </form>
      <p role="alert" className="waitlist-message">
        {failed ? "That token isn’t right." : null}
      </p>
    </section>
  );
}

function Row({ o }: { o: Order }) {
  return (
    <tr>
      <td>#{o.id}</td>
      <td>{date(o.createdAt)}</td>
      <td>
        {o.customerName}
        <span className="admin-sub">{o.email}</span>
      </td>
      <td>
        {o.city}, {o.state} {o.zip}
      </td>
      <td>{itemsSummary(o.lineItems)}</td>
      <td className="admin-num">{o.weightOz} oz</td>
      <td className="admin-num">{formatUsd(o.amountPaidCents)}</td>
      <td>
        {o.status}
        {o.trackingNumber ? (
          <span className="admin-sub">
            {o.carrier ? `${o.carrier} ` : ""}
            {o.trackingNumber}
            {o.shippingEmailSentAt ? "" : " · not emailed"}
          </span>
        ) : null}
      </td>
      <td>
        {o.status === "unshipped" ? (
          <details className="admin-actions">
            <summary>Update</summary>
            <form method="post" action={`/api/admin/orders/${o.id}/`}>
              <input name="tracking" placeholder="Tracking (optional)" className="admin-input" />
              <input name="carrier" placeholder="Carrier" defaultValue="USPS" className="admin-input" />
              <button name="action" value="ship" className="admin-button">
                Mark shipped
              </button>
              <button name="action" value="cancel" className="admin-button admin-button-quiet">
                Cancel order
              </button>
            </form>
          </details>
        ) : null}
      </td>
    </tr>
  );
}

export default async function Admin({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const authed = await isAdmin();

  const head = (
    <div className="topline">
      <span className="wordmark">{SITE.name}</span>
      {authed ? (
        <form method="post" action="/api/admin/logout/">
          <button className="eyebrow admin-link">Sign out</button>
        </form>
      ) : (
        <span className="eyebrow">Admin</span>
      )}
    </div>
  );

  if (!authed) {
    return (
      <main className="page">
        {head}
        <SignIn failed={q.error === "token"} />
      </main>
    );
  }

  const s = adminStore();
  if (!s.ok) {
    return (
      <main className="page">
        {head}
        <p className="admin-problem">Not configured: set {s.error.missing.join(", ")}.</p>
      </main>
    );
  }

  const status = isOrderStatus(q.status) ? q.status : undefined;
  const orders = await s.value.store.list({ livemode: s.value.livemode, ...(status ? { status } : {}) });

  return (
    <main className="page admin">
      {head}
      <section className="admin-head">
        <h1 className="display">Orders</h1>
        {s.value.livemode ? null : <p className="eyebrow">Test mode: showing test orders only</p>}
        {q.note ? (
          <p role="status" className="admin-note">
            {q.note}
          </p>
        ) : null}
      </section>

      <section aria-labelledby="ship" className="admin-block">
        <h2 id="ship" className="eyebrow">
          Ship
        </h2>
        <ol className="admin-steps">
          <li>
            <a href="/api/admin/export/" className="admin-button" download>
              Download unshipped orders
            </a>
            <span className="admin-sub">CSV for Pirate Ship’s import</span>
          </li>
          <li>
            <TrackingImport />
          </li>
        </ol>
      </section>

      <section aria-labelledby="list" className="admin-block">
        <h2 id="list" className="eyebrow">
          All orders
        </h2>
        <nav className="admin-filter" aria-label="Filter by status">
          {[undefined, ...ORDER_STATUSES].map((st) => (
            <a key={st ?? "all"} href={st ? `/admin/?status=${st}` : "/admin/"} aria-current={st === status ? "page" : undefined}>
              {st ?? "all"}
            </a>
          ))}
        </nav>
        {!orders.ok ? (
          <p className="admin-problem">Couldn’t read orders ({orders.error.kind}).</p>
        ) : orders.value.length === 0 ? (
          <p className="admin-sub">No {status ?? ""} orders.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Ship to</th>
                  <th>Items</th>
                  <th className="admin-num">Weight</th>
                  <th className="admin-num">Paid</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.value.map((o) => (
                  <Row key={o.id} o={o} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
