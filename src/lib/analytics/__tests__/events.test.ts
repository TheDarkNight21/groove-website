import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { analyticsConfig } from "../config";
import {
  CHECKOUT_STEPS,
  HOME_SECTIONS,
  MIN_SPIN_DEG,
  failureCode,
  initialSteps,
  isPrivatePath,
  scrubProperties,
  scrubUrl,
  optChoice,
  orderPaidCapture,
  spinSummary,
  stepChange,
  toCapture,
  visitorFromBody,
  visitorFromMetadata,
  visitorMetadata,
  type AnalyticsEvent,
  type FieldChange,
  type Hold,
  type PaidOrder,
  type StepProgress,
} from "../events";
import { captureRequest, captureSender } from "../server";

const step = fc.constantFrom(...CHECKOUT_STEPS);
const section = fc.constantFrom(...HOME_SECTIONS);
const method = fc.constantFrom("card" as const, "wallet" as const);

const anyEvent: fc.Arbitrary<AnalyticsEvent> = fc.oneof(
  fc.record({ kind: fc.constant("section_viewed" as const), section }),
  fc.record({
    kind: fc.constant("record_spun" as const),
    pointer: fc.constantFrom("mouse" as const, "touch" as const, "pen" as const),
    durationMs: fc.nat(),
    direction: fc.constantFrom("forward" as const, "backward" as const),
    turnedDeg: fc.nat(),
    flingDegPerSec: fc.nat(),
  }),
  fc.record({ kind: fc.constant("preorder_clicked" as const), from: section }),
  fc.record({ kind: fc.constant("gallery_slide_viewed" as const), index: fc.nat() }),
  fc.record({ kind: fc.constant("checkout_opened" as const) }),
  fc.record({ kind: fc.constant("checkout_unavailable" as const), reason: fc.constantFrom("stripe-js" as const, "session" as const, "field" as const) }),
  fc.record({ kind: fc.constant("wallets_offered" as const), applePay: fc.boolean(), googlePay: fc.boolean() }),
  fc.record({ kind: fc.constant("packs_changed" as const), packs: fc.integer({ min: 1, max: 10 }) }),
  fc.record({ kind: fc.constant("checkout_step_started" as const), step }),
  fc.record({ kind: fc.constant("checkout_step_completed" as const), step }),
  fc.record({ kind: fc.constant("wallet_cancelled" as const) }),
  fc.record({ kind: fc.constant("pay_submitted" as const), method }),
  fc.record({ kind: fc.constant("pay_failed" as const), method, code: fc.constantFrom("other", "declined:insufficient_funds") }),
  fc.record({
    kind: fc.constant("order_paid" as const),
    skus: fc.array(fc.constantFrom("miami-12pk")),
    packs: fc.integer({ min: 1, max: 10 }),
    amountCents: fc.nat(),
    currency: fc.constant("usd"),
    livemode: fc.boolean(),
  }),
);

describe("toCapture", () => {
  it("names the event after its kind and carries exactly the event's own fields", () => {
    fc.assert(
      fc.property(anyEvent, (e) => {
        const c = toCapture(e);
        expect(c.name).toBe(e.kind);
        // Nothing invented, nothing dropped: one property per field besides `kind`.
        expect(Object.keys(c.properties)).toHaveLength(Object.keys(e).length - 1);
        expect(Object.values(c.properties).sort()).toEqual(
          Object.entries(e)
            .filter(([k]) => k !== "kind")
            .map(([, v]) => v)
            .sort(),
        );
      }),
    );
  });

  it("uses snake_case property names", () => {
    fc.assert(fc.property(anyEvent, (e) => Object.keys(toCapture(e).properties).every((k) => /^[a-z]+(_[a-z]+)*$/.test(k))));
  });
});

const hold = (over: Partial<Hold> = {}): Hold => ({
  pointer: "mouse",
  grabbedAt: 10,
  releasedAt: 10.4,
  grabAngle: 0,
  releaseAngle: 0,
  releaseVelocity: 0,
  ...over,
});

describe("spinSummary", () => {
  it("a press that never moved the record is not a spin", () => {
    fc.assert(
      fc.property(fc.double({ min: -MIN_SPIN_DEG + 0.01, max: MIN_SPIN_DEG - 0.01, noNaN: true }), fc.double({ min: -1e6, max: 1e6, noNaN: true }), (turned, start) => {
        expect(spinSummary(hold({ grabAngle: start, releaseAngle: start + turned }))).toBeUndefined();
      }),
    );
  });

  it("a flick counts however little the record turned, and its direction is the flick's", () => {
    fc.assert(
      fc.property(fc.double({ min: 1, max: 4000, noNaN: true }), fc.boolean(), (speed, forward) => {
        const s = spinSummary(hold({ releaseVelocity: forward ? speed : -speed }));
        expect(s?.direction).toBe(forward ? "forward" : "backward");
        expect(s?.flingDegPerSec).toBe(Math.round(speed));
      }),
    );
  });

  it("a slow drag with no flick takes its direction from the way it turned", () => {
    expect(spinSummary(hold({ releaseAngle: -90 }))).toMatchObject({ direction: "backward", turnedDeg: 90, flingDegPerSec: 0, durationMs: 400 });
    expect(spinSummary(hold({ releaseAngle: 90 }))).toMatchObject({ direction: "forward", turnedDeg: 90 });
  });

  it("never reports a negative duration, turn or speed", () => {
    fc.assert(
      fc.property(
        fc.record({
          grabbedAt: fc.double({ min: 0, max: 1e6, noNaN: true }),
          releasedAt: fc.double({ min: 0, max: 1e6, noNaN: true }),
          grabAngle: fc.double({ min: -1e6, max: 1e6, noNaN: true }),
          releaseAngle: fc.double({ min: -1e6, max: 1e6, noNaN: true }),
          releaseVelocity: fc.double({ min: -4000, max: 4000, noNaN: true }),
        }),
        (h) => {
          const s = spinSummary(hold(h));
          if (!s) return;
          expect(s.durationMs).toBeGreaterThanOrEqual(0);
          expect(s.turnedDeg).toBeGreaterThanOrEqual(0);
          expect(s.flingDegPerSec).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });
});

const anyChange: fc.Arbitrary<FieldChange> = fc.record({ step, empty: fc.boolean(), complete: fc.boolean() });

const run = (changes: readonly FieldChange[]) =>
  changes.reduce<readonly [StepProgress, readonly AnalyticsEvent[]]>(
    ([p, sent], c) => {
      const [next, events] = stepChange(p, c);
      return [next, [...sent, ...events]];
    },
    [initialSteps, []],
  );

describe("stepChange", () => {
  it("fires each step's start and completion at most once, whatever is typed in whatever order", () => {
    fc.assert(
      fc.property(fc.array(anyChange, { maxLength: 60 }), (changes) => {
        const names = run(changes)[1].map((e) => `${e.kind}:${"step" in e ? e.step : ""}`);
        expect(new Set(names).size).toBe(names.length);
      }),
    );
  });

  it("a step is never completed without having started", () => {
    fc.assert(
      fc.property(fc.array(anyChange, { maxLength: 60 }), (changes) => {
        const [progress] = run(changes);
        for (const s of progress.completed) expect(progress.started.has(s)).toBe(true);
      }),
    );
  });

  it("starts on the first character, completes when Stripe says the field group is complete", () => {
    const [p1, e1] = stepChange(initialSteps, { step: "contact", empty: true, complete: false });
    expect(e1).toEqual([]);
    const [p2, e2] = stepChange(p1, { step: "contact", empty: false, complete: false });
    expect(e2).toEqual([{ kind: "checkout_step_started", step: "contact" }]);
    const [, e3] = stepChange(p2, { step: "contact", empty: false, complete: true });
    expect(e3).toEqual([{ kind: "checkout_step_completed", step: "contact" }]);
  });

  it("autofill completing a field in one go reports both, start first", () => {
    expect(stepChange(initialSteps, { step: "shipping", empty: false, complete: true })[1].map((e) => e.kind)).toEqual([
      "checkout_step_started",
      "checkout_step_completed",
    ]);
  });
});

describe("failureCode", () => {
  it("names a decline by Stripe's code and everything else as other, never the message", () => {
    expect(failureCode({ code: "paymentFailed", paymentFailed: { declineCode: "insufficient_funds" } })).toBe("declined:insufficient_funds");
    expect(failureCode({ code: "paymentFailed", paymentFailed: { declineCode: null } })).toBe("declined:unknown");
    expect(failureCode({ code: null })).toBe("other");
  });
});

const uuid = fc.uuid();

describe("visitor ids", () => {
  it("survive the trip through Stripe metadata unchanged", () => {
    fc.assert(
      fc.property(uuid, fc.option(uuid, { nil: undefined }), (distinctId, sessionId) => {
        const v = visitorFromBody({ sku: "x", visitor: { distinctId, sessionId } });
        expect(v).toEqual({ distinctId, sessionId });
        expect(visitorFromMetadata(visitorMetadata(v))).toEqual(v);
      }),
    );
  });

  it("anything that isn't an id is dropped, so a request body can't write arbitrary text to Stripe", () => {
    fc.assert(
      fc.property(fc.anything(), (junk) => {
        const v = visitorFromBody(junk);
        if (v === undefined) return;
        expect(v.distinctId).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
      }),
    );
    expect(visitorFromBody({ visitor: { distinctId: "a b c <script>", sessionId: "x" } })).toBeUndefined();
    expect(visitorFromBody({ visitor: { distinctId: "x".repeat(65) } })).toBeUndefined();
    expect(visitorFromBody({ sku: "miami-12pk" })).toBeUndefined();
    expect(visitorFromBody(null)).toBeUndefined();
  });

  it("a bad session id is dropped but the visitor is kept", () => {
    expect(visitorFromBody({ visitor: { distinctId: "0190abcd-1234", sessionId: "not ok!" } })).toEqual({ distinctId: "0190abcd-1234", sessionId: undefined });
  });

  it("no visitor adds no metadata", () => {
    expect(visitorMetadata(undefined)).toEqual({});
    expect(visitorFromMetadata({ sku: "miami-12pk" })).toBeUndefined();
    expect(visitorFromMetadata(null)).toBeUndefined();
  });
});

const order: PaidOrder = {
  stripeSessionId: "cs_test_abc",
  livemode: false,
  lineItems: [{ sku: "miami-12pk", qty: 2 }],
  amountPaidCents: 7200,
  currency: "usd",
};

describe("orderPaidCapture", () => {
  it("files the order under the visit that opened the checkout", () => {
    expect(orderPaidCapture(order, { distinctId: "visitor-12345", sessionId: "session-12345" })).toEqual({
      name: "order_paid",
      properties: { skus: ["miami-12pk"], packs: 2, amount_cents: 7200, currency: "usd", livemode: false },
      distinctId: "visitor-12345",
      sessionId: "session-12345",
    });
  });

  it("an order with no visitor is filed under its Stripe session, so it still counts", () => {
    expect(orderPaidCapture(order, undefined)).toMatchObject({ distinctId: "cs_test_abc", sessionId: undefined });
  });

  it("carries nothing about who bought", () => {
    const withPerson = { ...order, email: "ada@example.com", customerName: "Ada", line1: "1 Main St" };
    expect(JSON.stringify(orderPaidCapture(withPerson, undefined))).not.toMatch(/ada|Main/i);
  });
});

describe("optChoice", () => {
  it("reads ?analytics=off and ?analytics=on, and nothing else", () => {
    expect(optChoice("?analytics=off")).toBe("off");
    expect(optChoice("?sku=miami-12pk&analytics=on")).toBe("on");
    expect(optChoice("?analytics=maybe")).toBeUndefined();
    expect(optChoice("")).toBeUndefined();
  });
});

describe("analyticsConfig", () => {
  it("is absent unless both the key and an https host are set", () => {
    expect(analyticsConfig({ key: undefined, host: "https://us.i.posthog.com" })).toBeUndefined();
    expect(analyticsConfig({ key: "phc_x", host: undefined })).toBeUndefined();
    expect(analyticsConfig({ key: " ", host: "https://us.i.posthog.com" })).toBeUndefined();
    expect(analyticsConfig({ key: "phc_x", host: "not a url" })).toBeUndefined();
    expect(analyticsConfig({ key: "phc_x", host: "http://us.i.posthog.com" })).toBeUndefined();
  });

  it("derives PostHog Cloud's script and app hosts from the ingest host, for either region", () => {
    expect(analyticsConfig({ key: "phc_x", host: "https://us.i.posthog.com/" })).toEqual({
      key: "phc_x",
      host: "https://us.i.posthog.com",
      assetsHost: "https://us-assets.i.posthog.com",
      uiHost: "https://us.posthog.com",
    });
    expect(analyticsConfig({ key: "phc_x", host: "https://eu.i.posthog.com" })).toMatchObject({
      assetsHost: "https://eu-assets.i.posthog.com",
      uiHost: "https://eu.posthog.com",
    });
  });
});

const config = analyticsConfig({ key: "phc_x", host: "https://us.i.posthog.com" })!;
const capture = orderPaidCapture(order, { distinctId: "visitor-12345", sessionId: "session-12345" });
const at = new Date("2026-11-10T12:00:00Z");

describe("captureSender", () => {
  it("posts the event to PostHog's capture API under the visitor and their session", async () => {
    const calls: { url: string; body: unknown }[] = [];
    const send = captureSender(config, (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      return new Response("{}", { status: 200 });
    }) as typeof fetch);
    expect(await send(capture, at)).toEqual({ ok: true, value: true });
    expect(calls).toEqual([
      {
        url: "https://us.i.posthog.com/i/v0/e/",
        body: {
          api_key: "phc_x",
          event: "order_paid",
          distinct_id: "visitor-12345",
          timestamp: "2026-11-10T12:00:00.000Z",
          properties: { skus: ["miami-12pk"], packs: 2, amount_cents: 7200, currency: "usd", livemode: false, $session_id: "session-12345" },
        },
      },
    ]);
  });

  it("leaves the session out when there isn't one", () => {
    const body = JSON.parse(captureRequest(config, orderPaidCapture(order, undefined), at).body);
    expect(body.properties).not.toHaveProperty("$session_id");
  });

  it("returns a refusal or a dead network as a value, never a throw", async () => {
    const refused = captureSender(config, (async () => new Response("no", { status: 401 })) as typeof fetch);
    expect(await refused(capture, at)).toEqual({ ok: false, error: { kind: "upstream", status: 401 } });
    const dead = captureSender(config, (async () => {
      throw new Error("offline");
    }) as typeof fetch);
    expect(await dead(capture, at)).toEqual({ ok: false, error: { kind: "network" } });
  });
});

describe("what never leaves the site", () => {
  it("the admin and its API are private; the shop is not", () => {
    for (const p of ["/admin", "/admin/", "/admin/orders/7/", "/api/admin/export/"]) expect(isPrivatePath(p)).toBe(true);
    for (const p of ["/", "/preorder/", "/thanks/", "/administer/", "/lab/"]) expect(isPrivatePath(p)).toBe(false);
  });

  it("blanks the Stripe session id wherever it sits in a URL and keeps the rest", () => {
    expect(scrubUrl("https://www.groovedrinks.com/thanks/?session_id=cs_live_a1B2c3")).toBe("https://www.groovedrinks.com/thanks/?session_id=removed");
    expect(scrubUrl("/thanks/?utm_source=ig&session_id=cs_test_x&sku=miami-12pk#top")).toBe("/thanks/?utm_source=ig&session_id=removed&sku=miami-12pk#top");
  });

  it("no session id survives scrubbing, whatever surrounds it", () => {
    fc.assert(
      fc.property(fc.webUrl(), fc.stringMatching(/^cs_(test|live)_[A-Za-z0-9]{6,40}$/), fc.constantFrom("?", "&"), (url, id, joiner) => {
        const sep = url.includes("?") ? "&" : joiner === "&" ? "?" : joiner;
        expect(scrubUrl(`${url}${sep}session_id=${id}`)).not.toContain(id);
      }),
    );
  });

  it("leaves URLs without a secret exactly as they were", () => {
    fc.assert(fc.property(fc.webUrl({ withQueryParameters: true }), (url) => url.includes("session_id=") || scrubUrl(url) === url));
  });

  it("scrubs every string property and leaves other values alone", () => {
    expect(scrubProperties({ $current_url: "https://x.test/thanks/?session_id=cs_test_abc", packs: 2, flags: ["a"] })).toEqual({
      $current_url: "https://x.test/thanks/?session_id=removed",
      packs: 2,
      flags: ["a"],
    });
  });
});
