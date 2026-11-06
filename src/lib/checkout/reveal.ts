// When the real checkout replaces its outline. Stripe's fields load one iframe at a
// time; showing each as it lands makes the form assemble itself in front of the
// buyer. Instead the outline stays until the session is open and every field has
// said it's ready, then the whole form appears at once.

export type Part = "contact" | "address" | "payment" | "express";

// The fields a buyer types into. Express (Apple Pay, Google Pay) can be slow or
// absent on a device, so it gets a short grace period instead of a veto.
export const FIELDS: readonly Part[] = ["contact", "address", "payment"];

export type Reveal = {
  readonly session: boolean; // the Checkout Session loaded: amounts are real
  readonly ready: ReadonlySet<Part>;
  readonly expressGraceOver: boolean;
};

export const initialReveal: Reveal = { session: false, ready: new Set(), expressGraceOver: false };

export type RevealEvent =
  | { readonly kind: "session" }
  | { readonly kind: "ready"; readonly part: Part }
  | { readonly kind: "express-grace-over" };

export const revealStep = (s: Reveal, e: RevealEvent): Reveal => {
  switch (e.kind) {
    case "session":
      return s.session ? s : { ...s, session: true };
    case "ready":
      return s.ready.has(e.part) ? s : { ...s, ready: new Set([...s.ready, e.part]) };
    case "express-grace-over":
      return s.expressGraceOver ? s : { ...s, expressGraceOver: true };
    default: {
      const never: never = e;
      return never;
    }
  }
};

export const fieldsReady = (s: Reveal): boolean => s.session && FIELDS.every((p) => s.ready.has(p));

export const revealed = (s: Reveal): boolean => fieldsReady(s) && (s.ready.has("express") || s.expressGraceOver);
