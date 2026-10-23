export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type Email = string & { readonly __brand: "Email" };
export type EmailError = "empty" | "too-long" | "malformed";

const MAX_LENGTH = 254;
const SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

// Smart constructor: the only way to get an Email. Normalises case and whitespace.
export function parseEmail(raw: unknown): Result<Email, EmailError> {
  const trimmed = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (trimmed === "") return { ok: false, error: "empty" };
  if (trimmed.length > MAX_LENGTH) return { ok: false, error: "too-long" };
  if (!SHAPE.test(trimmed)) return { ok: false, error: "malformed" };
  return { ok: true, value: trimmed as Email };
}
