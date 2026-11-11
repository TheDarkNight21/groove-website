// Every behaviour event the site records, in one place. Pure: components build one of
// these, `toCapture` names it and lists its properties, and the edge (client.ts in the
// browser, server.ts in the webhook) sends it. No event carries an email, a name, an
// address or card data: each property below is a number, a flag or a fixed word.

export const HOME_SECTIONS = ["the-can", "why", "inside", "people", "lab"] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];

export const CHECKOUT_STEPS = ["contact", "shipping", "payment"] as const;
export type CheckoutStep = (typeof CHECKOUT_STEPS)[number];

export type PayMethod = "card" | "wallet";
export type PointerKind = "mouse" | "touch" | "pen";
export type SpinDirection = "forward" | "backward";
export type UnavailableReason = "stripe-js" | "session" | "field";

export type AnalyticsEvent =
  | { readonly kind: "section_viewed"; readonly section: HomeSection }
  | {
      readonly kind: "record_spun";
      readonly pointer: PointerKind;
      readonly durationMs: number;
      readonly direction: SpinDirection;
      readonly turnedDeg: number;
      readonly flingDegPerSec: number;
    }
  | { readonly kind: "preorder_clicked"; readonly from: HomeSection }
  | { readonly kind: "gallery_slide_viewed"; readonly index: number }
  | { readonly kind: "checkout_opened" }
  | { readonly kind: "checkout_unavailable"; readonly reason: UnavailableReason }
  | { readonly kind: "wallets_offered"; readonly applePay: boolean; readonly googlePay: boolean }
  | { readonly kind: "packs_changed"; readonly packs: number }
  | { readonly kind: "checkout_step_started"; readonly step: CheckoutStep }
  | { readonly kind: "checkout_step_completed"; readonly step: CheckoutStep }
  | { readonly kind: "wallet_cancelled" }
  | { readonly kind: "pay_submitted"; readonly method: PayMethod }
  | { readonly kind: "pay_failed"; readonly method: PayMethod; readonly code: string }
  | {
      readonly kind: "order_paid";
      readonly skus: readonly string[];
      readonly packs: number;
      readonly amountCents: number;
      readonly currency: string;
      readonly livemode: boolean;
    };

export type PropertyValue = string | number | boolean | readonly string[];
export type Capture = { readonly name: string; readonly properties: Readonly<Record<string, PropertyValue>> };

// The event's name and properties as PostHog receives them.
export const toCapture = (e: AnalyticsEvent): Capture => {
  switch (e.kind) {
    case "section_viewed":
      return { name: e.kind, properties: { section: e.section } };
    case "record_spun":
      return {
        name: e.kind,
        properties: {
          pointer: e.pointer,
          duration_ms: e.durationMs,
          direction: e.direction,
          turned_deg: e.turnedDeg,
          fling_deg_per_s: e.flingDegPerSec,
        },
      };
    case "preorder_clicked":
      return { name: e.kind, properties: { from: e.from } };
    case "gallery_slide_viewed":
      return { name: e.kind, properties: { index: e.index } };
    case "checkout_opened":
    case "wallet_cancelled":
      return { name: e.kind, properties: {} };
    case "checkout_unavailable":
      return { name: e.kind, properties: { reason: e.reason } };
    case "wallets_offered":
      return { name: e.kind, properties: { apple_pay: e.applePay, google_pay: e.googlePay } };
    case "packs_changed":
      return { name: e.kind, properties: { packs: e.packs } };
    case "checkout_step_started":
    case "checkout_step_completed":
      return { name: e.kind, properties: { step: e.step } };
    case "pay_submitted":
      return { name: e.kind, properties: { method: e.method } };
    case "pay_failed":
      return { name: e.kind, properties: { method: e.method, code: e.code } };
    case "order_paid":
      return {
        name: e.kind,
        properties: { skus: e.skus, packs: e.packs, amount_cents: e.amountCents, currency: e.currency, livemode: e.livemode },
      };
    default: {
      const never: never = e;
      return never;
    }
  }
};

// ---- The record ----

// A press that turned the record less than this and let go without a flick is a tap,
// not a spin.
export const MIN_SPIN_DEG = 5;

export type Hold = {
  readonly pointer: PointerKind;
  readonly grabbedAt: number; // seconds
  readonly releasedAt: number; // seconds
  readonly grabAngle: number; // degrees
  readonly releaseAngle: number; // degrees
  readonly releaseVelocity: number; // degrees per second, signed
};

// What one hold of the record amounted to, or nothing if the hand never moved it.
export const spinSummary = (h: Hold): Extract<AnalyticsEvent, { kind: "record_spun" }> | undefined => {
  const turned = h.releaseAngle - h.grabAngle;
  if (Math.abs(turned) < MIN_SPIN_DEG && h.releaseVelocity === 0) return undefined;
  const lean = h.releaseVelocity !== 0 ? h.releaseVelocity : turned;
  return {
    kind: "record_spun",
    pointer: h.pointer,
    durationMs: Math.max(0, Math.round((h.releasedAt - h.grabbedAt) * 1000)),
    direction: lean >= 0 ? "forward" : "backward",
    turnedDeg: Math.round(Math.abs(turned)),
    flingDegPerSec: Math.round(Math.abs(h.releaseVelocity)),
  };
};

export const pointerKind = (pointerType: string): PointerKind =>
  pointerType === "touch" || pointerType === "pen" ? pointerType : "mouse";

// ---- Checkout steps ----

// Stripe's fields report every keystroke; a step counts once when first typed into
// and once when first complete.
export type StepProgress = { readonly started: ReadonlySet<CheckoutStep>; readonly completed: ReadonlySet<CheckoutStep> };
export const initialSteps: StepProgress = { started: new Set(), completed: new Set() };

export type FieldChange = { readonly step: CheckoutStep; readonly empty: boolean; readonly complete: boolean };

export const stepChange = (p: StepProgress, c: FieldChange): readonly [StepProgress, readonly AnalyticsEvent[]] => {
  const starts = (!c.empty || c.complete) && !p.started.has(c.step);
  const completes = c.complete && !p.completed.has(c.step);
  if (!starts && !completes) return [p, []];
  return [
    {
      started: starts ? new Set([...p.started, c.step]) : p.started,
      completed: completes ? new Set([...p.completed, c.step]) : p.completed,
    },
    [
      ...(starts ? [{ kind: "checkout_step_started", step: c.step } as const] : []),
      ...(completes ? [{ kind: "checkout_step_completed", step: c.step } as const] : []),
    ],
  ];
};

// Why a payment didn't go through, as a fixed word: Stripe's decline code when the
// card was declined, never its message (messages can quote what the buyer typed).
export type ConfirmFailure = { readonly code: string | null; readonly paymentFailed?: { readonly declineCode: string | null } };
export const failureCode = (e: ConfirmFailure): string =>
  e.code === "paymentFailed" ? `declined:${e.paymentFailed?.declineCode ?? "unknown"}` : "other";

// ---- Linking a visit to its order ----

// PostHog's ids for the browser that opened a checkout. They ride on the Stripe
// session's metadata so the webhook can say which visit the paid order belongs to.
export type VisitorIds = { readonly distinctId: string; readonly sessionId: string | undefined };

export const VISITOR_METADATA = { distinctId: "ph_distinct_id", sessionId: "ph_session_id" } as const;

// PostHog's ids are UUIDs; anything else from a request body is dropped, not stored.
const ID = /^[A-Za-z0-9_-]{8,64}$/;
const idOf = (v: unknown): string | undefined => (typeof v === "string" && ID.test(v) ? v : undefined);

const field = (o: unknown, key: string): unknown =>
  o !== null && typeof o === "object" && key in o ? (o as Record<string, unknown>)[key] : undefined;

const visitorFrom = (distinctId: unknown, sessionId: unknown): VisitorIds | undefined => {
  const id = idOf(distinctId);
  return id === undefined ? undefined : { distinctId: id, sessionId: idOf(sessionId) };
};

// From the body of POST /api/checkout/session/: { visitor: { distinctId, sessionId } }.
export const visitorFromBody = (body: unknown): VisitorIds | undefined => {
  const v = field(body, "visitor");
  return visitorFrom(field(v, "distinctId"), field(v, "sessionId"));
};

export const visitorMetadata = (v: VisitorIds | undefined): Readonly<Record<string, string>> =>
  v === undefined
    ? {}
    : {
        [VISITOR_METADATA.distinctId]: v.distinctId,
        ...(v.sessionId === undefined ? {} : { [VISITOR_METADATA.sessionId]: v.sessionId }),
      };

export const visitorFromMetadata = (metadata: unknown): VisitorIds | undefined =>
  visitorFrom(field(metadata, VISITOR_METADATA.distinctId), field(metadata, VISITOR_METADATA.sessionId));

// One event addressed to one visitor, as the server sends it.
export type ServerCapture = Capture & { readonly distinctId: string; readonly sessionId: string | undefined };

export type PaidOrder = {
  readonly stripeSessionId: string;
  readonly livemode: boolean;
  readonly lineItems: readonly { readonly sku: string; readonly qty: number }[];
  readonly amountPaidCents: number;
  readonly currency: string;
};

// The paid order as an event on the visit that made it. A checkout opened without
// JavaScript has no visitor; its order is filed under the Stripe session id so it
// still counts as a sale.
export const orderPaidCapture = (order: PaidOrder, visitor: VisitorIds | undefined): ServerCapture => ({
  ...toCapture({
    kind: "order_paid",
    skus: order.lineItems.map((l) => l.sku),
    packs: order.lineItems.reduce((n, l) => n + l.qty, 0),
    amountCents: order.amountPaidCents,
    currency: order.currency,
    livemode: order.livemode,
  }),
  distinctId: visitor?.distinctId ?? order.stripeSessionId,
  sessionId: visitor?.sessionId,
});

// ---- Opting a browser out ----

// ?analytics=off stops this browser being recorded, for good; ?analytics=on undoes it.
export const OPT_PARAM = "analytics";
export type OptChoice = "off" | "on";
export const optChoice = (search: string): OptChoice | undefined => {
  const v = new URLSearchParams(search).get(OPT_PARAM);
  return v === "off" || v === "on" ? v : undefined;
};

// ---- What never leaves the site ----

// The admin shows customers' names and addresses as page text, which input masking
// doesn't cover: nothing under these paths is recorded at all, events or replays.
export const PRIVATE_PATHS = ["/admin", "/api/admin"] as const;
export const isPrivatePath = (pathname: string): boolean =>
  PRIVATE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

// Query values that open something: the Stripe session id on /thanks shows that order's
// summary to whoever holds it. They are blanked in every URL an event carries.
export const SECRET_PARAMS = ["session_id"] as const;
const SCRUBBED = "removed";

export const scrubUrl = (value: string): string => {
  if (!SECRET_PARAMS.some((p) => value.includes(`${p}=`))) return value;
  const pattern = new RegExp(`([?&#](?:${SECRET_PARAMS.join("|")})=)[^&#]*`, "g");
  return value.replace(pattern, `$1${SCRUBBED}`);
};

// Whether an address carries one of those values. A page opened with one gets no
// replay at all: a replay stores the page's own address in data we don't shape.
export const carriesSecret = (search: string): boolean => {
  const params = new URLSearchParams(search);
  return SECRET_PARAMS.some((p) => params.has(p));
};

const scrubValue = (v: unknown): unknown => {
  if (typeof v === "string") return scrubUrl(v);
  if (Array.isArray(v)) return v.map(scrubValue);
  if (v !== null && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, inner]) => [k, scrubValue(inner)]));
  return v;
};

// Every string anywhere in an event's properties, scrubbed, however deeply nested;
// everything else untouched.
export const scrubProperties = <T extends Readonly<Record<string, unknown>>>(properties: T): T => scrubValue(properties) as T;
