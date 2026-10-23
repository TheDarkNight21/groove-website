// Pure physics for the hero record. Angles in degrees, time in seconds.
// The component feeds pointer events and frame ticks in; nothing here touches the DOM.

export const TURNTABLE = {
  /** Platter speed while idle, in rpm. */
  idleRpm: 100 / 3,
  /** Platter speed once someone has joined the waitlist. */
  joinedRpm: 45,
  /** Time constant (s) of the motor pulling the platter back to speed. */
  motorTau: 0.9,
  /** Only pointer samples this recent count toward release velocity. */
  velocityWindow: 0.1,
  /** Upper bound on a flick, in deg/s, so one wild throw can't blur the label. */
  maxVelocity: 4000,
} as const;

export const rpmToDegPerSec = (rpm: number) => rpm * 6;
export const degPerSecToRpm = (v: number) => v / 6;

type Sample = { readonly t: number; readonly angle: number };

export type Drag = {
  readonly lastPointer: number;
  readonly samples: readonly Sample[];
};

export type Turntable = {
  readonly angle: number;
  readonly velocity: number;
  readonly drag: Drag | null;
};

export const initialTurntable: Turntable = { angle: 0, velocity: 0, drag: null };

/** Signed shortest rotation from `from` to `to`, in (-180, 180]. */
export function shortestDelta(from: number, to: number): number {
  const d = (((to - from) % 360) + 540) % 360 - 180;
  return d === -180 ? 180 : d;
}

/** Pointer angle around a centre, in degrees (0 = right, clockwise positive on screen). */
export function pointerAngle(cx: number, cy: number, x: number, y: number): number {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
}

const recent = (samples: readonly Sample[], now: number) =>
  samples.filter((s) => now - s.t <= TURNTABLE.velocityWindow);

const clamp = (v: number, limit: number) => Math.max(-limit, Math.min(limit, v));

/** Grabbing stops the platter under the hand; it keeps its current angle (no jump). */
export function grab(state: Turntable, pointer: number, t: number): Turntable {
  return {
    angle: state.angle,
    velocity: 0,
    drag: { lastPointer: pointer, samples: [{ t, angle: state.angle }] },
  };
}

/** While dragging the record follows the pointer 1:1, keeping the original grab offset. */
export function move(state: Turntable, pointer: number, t: number): Turntable {
  if (!state.drag) return state;
  const angle = state.angle + shortestDelta(state.drag.lastPointer, pointer);
  return {
    angle,
    velocity: state.velocity,
    drag: {
      lastPointer: pointer,
      samples: [...recent(state.drag.samples, t), { t, angle }],
    },
  };
}

/** Release velocity from the recent pointer history (0 if the hand was held still). */
export function releaseVelocity(samples: readonly Sample[], t: number): number {
  const window = recent(samples, t);
  if (window.length < 2) return 0;
  const first = window[0];
  const last = window[window.length - 1];
  const span = last.t - first.t;
  return span > 0 ? clamp((last.angle - first.angle) / span, TURNTABLE.maxVelocity) : 0;
}

/** Letting go hands the hand's velocity straight to the platter: no seam. */
export function release(state: Turntable, t: number): Turntable {
  if (!state.drag) return state;
  return { angle: state.angle, velocity: releaseVelocity(state.drag.samples, t), drag: null };
}

/**
 * Advance the free platter by dt. The motor pulls velocity exponentially toward
 * `target` (deg/s); the angle integrates that exact curve. A held record doesn't move.
 */
export function tick(state: Turntable, dt: number, target: number): Turntable {
  if (state.drag || dt <= 0) return state;
  const tau = TURNTABLE.motorTau;
  const decay = Math.exp(-dt / tau);
  const gap = state.velocity - target;
  return {
    angle: state.angle + target * dt + gap * tau * (1 - decay),
    velocity: target + gap * decay,
    drag: null,
  };
}

/** "33⅓" at speed, otherwise one decimal. Negative when spun backwards. */
export function formatRpm(velocity: number): string {
  const rpm = degPerSecToRpm(velocity);
  if (Math.abs(rpm - TURNTABLE.idleRpm) < 0.05) return "33⅓";
  const rounded = Math.round(rpm * 10) / 10;
  if (Object.is(rounded, -0) || rounded === 0) return "0.0";
  return rounded < 0 ? `−${Math.abs(rounded).toFixed(1)}` : rounded.toFixed(1);
}
