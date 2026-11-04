// The pack stepper. Bounds come from the session's line item (adjustable_quantity),
// so the page can't offer a quantity Stripe would refuse.

export type PackBounds = { readonly min: number; readonly max: number };

export const clampPacks = (n: number, b: PackBounds): number => Math.min(b.max, Math.max(b.min, Math.trunc(n)));

export type Step = 1 | -1;

export const stepPacks = (current: number, step: Step, b: PackBounds): number => clampPacks(current + step, b);

// A step that wouldn't change anything is a disabled button, not a no-op request.
export const canStep = (current: number, step: Step, b: PackBounds): boolean => stepPacks(current, step, b) !== current;

// The session's own bounds, or none: without them the line isn't adjustable.
export const boundsOf = (adjustable: { readonly minimum: number; readonly maximum: number } | null): PackBounds | undefined =>
  adjustable && adjustable.minimum <= adjustable.maximum ? { min: adjustable.minimum, max: adjustable.maximum } : undefined;
