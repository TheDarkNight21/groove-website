import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { FIELDS, initialReveal, revealed, revealStep, type Part, type RevealEvent } from "../reveal";

const part: fc.Arbitrary<Part> = fc.constantFrom("contact", "address", "payment", "express");
const event: fc.Arbitrary<RevealEvent> = fc.oneof(
  fc.constant<RevealEvent>({ kind: "session" }),
  fc.constant<RevealEvent>({ kind: "express-grace-over" }),
  part.map<RevealEvent>((p) => ({ kind: "ready", part: p })),
);
const run = (events: readonly RevealEvent[]) => events.reduce(revealStep, initialReveal);

describe("reveal", () => {
  it("stays hidden until the session and every field are ready, and express is ready or out of grace", () => {
    fc.assert(
      fc.property(fc.array(event, { maxLength: 20 }), (events) => {
        const has = (p: Part) => events.some((e) => e.kind === "ready" && e.part === p);
        const expected =
          events.some((e) => e.kind === "session") &&
          FIELDS.every(has) &&
          (has("express") || events.some((e) => e.kind === "express-grace-over"));
        expect(revealed(run(events))).toBe(expected);
      }),
    );
  });

  it("order doesn't matter: any permutation of the same events lands in the same answer", () => {
    fc.assert(
      fc.property(fc.array(event, { maxLength: 12 }).chain((es) => fc.tuple(fc.constant(es), fc.shuffledSubarray(es, { minLength: es.length, maxLength: es.length }))), ([a, b]) => {
        expect(revealed(run(a))).toBe(revealed(run(b)));
      }),
    );
  });

  it("repeating an event changes nothing (idempotent), and returns the same state", () => {
    fc.assert(
      fc.property(fc.array(event, { maxLength: 12 }), event, (events, e) => {
        const once = revealStep(run(events), e);
        expect(revealStep(once, e)).toBe(once);
      }),
    );
  });

  it("a slow Apple Pay doesn't hold the form back once its grace is over", () => {
    const fieldsIn = run([{ kind: "session" }, ...FIELDS.map((p): RevealEvent => ({ kind: "ready", part: p }))]);
    expect(revealed(fieldsIn)).toBe(false);
    expect(revealed(revealStep(fieldsIn, { kind: "express-grace-over" }))).toBe(true);
    expect(revealed(revealStep(fieldsIn, { kind: "ready", part: "express" }))).toBe(true);
  });
});
