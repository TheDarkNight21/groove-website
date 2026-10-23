import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  TURNTABLE,
  currentVelocity,
  formatRpm,
  grab,
  initialTurntable,
  move,
  release,
  rpmToDegPerSec,
  shortestDelta,
  tick,
  touchIntent,
} from "../turntable";

const angle = fc.double({ min: -1e4, max: 1e4, noNaN: true });
const velocity = fc.double({ min: -4000, max: 4000, noNaN: true });
const dt = fc.double({ min: 0, max: 1, noNaN: true });

describe("shortestDelta", () => {
  it("stays within (-180, 180] and lands on the target modulo 360", () => {
    fc.assert(
      fc.property(angle, angle, (a, b) => {
        const d = shortestDelta(a, b);
        expect(d).toBeGreaterThan(-180 - 1e-9);
        expect(d).toBeLessThanOrEqual(180 + 1e-9);
        const off = (((a + d - b) % 360) + 360) % 360;
        expect(Math.min(off, 360 - off)).toBeLessThan(1e-6);
      }),
    );
  });

  it("crosses the ±180 seam the short way", () => {
    expect(shortestDelta(170, -170)).toBeCloseTo(20);
    expect(shortestDelta(-170, 170)).toBeCloseTo(-20);
  });
});

describe("tick", () => {
  it("dt = 0 is the identity", () => {
    fc.assert(
      fc.property(angle, velocity, velocity, (a, v, target) => {
        const s = { angle: a, velocity: v, drag: null };
        expect(tick(s, 0, target)).toBe(s);
      }),
    );
  });

  it("never moves velocity further from the motor target", () => {
    fc.assert(
      fc.property(velocity, velocity, dt, (v, target, h) => {
        const next = tick({ angle: 0, velocity: v, drag: null }, h, target);
        expect(Math.abs(next.velocity - target)).toBeLessThanOrEqual(Math.abs(v - target) + 1e-9);
      }),
    );
  });

  it("splitting a step in two gives the same result (exact integration)", () => {
    fc.assert(
      fc.property(angle, velocity, velocity, dt, dt, (a, v, target, h1, h2) => {
        const s = { angle: a, velocity: v, drag: null };
        const once = tick(s, h1 + h2, target);
        const twice = tick(tick(s, h1, target), h2, target);
        expect(twice.angle).toBeCloseTo(once.angle, 6);
        expect(twice.velocity).toBeCloseTo(once.velocity, 6);
      }),
    );
  });

  it("does not move a record that is being held", () => {
    const held = grab({ angle: 30, velocity: 200, drag: null }, 0, 0);
    expect(tick(held, 0.5, 200)).toBe(held);
  });

  it("settles at the idle speed", () => {
    const target = rpmToDegPerSec(TURNTABLE.idleRpm);
    const settled = Array.from({ length: 600 }).reduce<typeof initialTurntable>(
      (s) => tick(s, 1 / 60, target),
      initialTurntable,
    );
    expect(formatRpm(settled.velocity)).toBe("33⅓");
  });
});

describe("drag", () => {
  it("keeps the grab offset: the record turns exactly as far as the pointer", () => {
    fc.assert(
      fc.property(
        angle,
        fc.double({ min: -180, max: 180, noNaN: true }),
        fc.array(fc.double({ min: -90, max: 90, noNaN: true }), { maxLength: 30 }),
        (start, p0, steps) => {
          const final = steps.reduce(
            (acc, step, i) => ({
              s: move(acc.s, acc.p + step, (i + 1) / 60),
              p: acc.p + step,
            }),
            { s: grab({ angle: start, velocity: 0, drag: null }, p0, 0), p: p0 },
          );
          expect(final.s.angle - start).toBeCloseTo(final.p - p0, 6);
        },
      ),
    );
  });

  it("hands the pointer's velocity to the platter on release", () => {
    // 10° per 1/100 s = 1000 °/s
    const s = [1, 2, 3, 4, 5].reduce(
      (acc, i) => move(acc, i * 10, i / 100),
      grab(initialTurntable, 0, 0),
    );
    expect(release(s, 0.05).velocity).toBeCloseTo(1000);
  });

  it("releases with zero velocity if the hand was held still", () => {
    const s = move(grab(initialTurntable, 0, 0), 40, 0.01);
    expect(release(s, 1).velocity).toBe(0);
  });
});

describe("formatRpm", () => {
  it.each([
    [rpmToDegPerSec(100 / 3), "33⅓"],
    [rpmToDegPerSec(45), "45.0"],
    [rpmToDegPerSec(-12.44), "−12.4"],
    [-0.01, "0.0"],
  ])("%d °/s → %s", (v, out) => {
    expect(formatRpm(v)).toBe(out);
  });
});

describe("touchIntent", () => {
  it.each([
    [3, 4, "pending"],
    [12, 2, "spin"],
    [-12, 5, "spin"],
    [2, 15, "scroll"],
    [4, -20, "scroll"],
  ] as const)("dx=%d dy=%d → %s", (dx, dy, out) => {
    expect(touchIntent(dx, dy)).toBe(out);
  });

  it("is symmetric under mirroring either axis", () => {
    fc.assert(
      fc.property(fc.double({ min: -100, max: 100, noNaN: true }), fc.double({ min: -100, max: 100, noNaN: true }), (dx, dy) => {
        const i = touchIntent(dx, dy);
        expect(touchIntent(-dx, dy)).toBe(i);
        expect(touchIntent(dx, -dy)).toBe(i);
      }),
    );
  });
});

describe("currentVelocity", () => {
  it("shows the hand's speed while dragging and agrees with release", () => {
    const s = [1, 2, 3, 4, 5].reduce((acc, i) => move(acc, i * 10, i / 100), grab(initialTurntable, 0, 0));
    expect(currentVelocity(s, 0.05)).toBeCloseTo(1000);
    expect(currentVelocity(s, 0.05)).toBe(release(s, 0.05).velocity);
  });

  it("is the platter velocity when nothing is held", () => {
    expect(currentVelocity({ angle: 0, velocity: 123, drag: null }, 9)).toBe(123);
  });
});
