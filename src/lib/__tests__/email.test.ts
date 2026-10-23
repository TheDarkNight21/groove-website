import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseEmail } from "../email";

describe("parseEmail", () => {
  it("accepts a normal address and normalises case and whitespace", () => {
    expect(parseEmail("  Faris@Example.COM ")).toEqual({ ok: true, value: "faris@example.com" });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    [undefined, "empty"],
    [42, "empty"],
    ["no-at-sign", "malformed"],
    ["a@b", "malformed"],
    ["a b@c.com", "malformed"],
    [`${"a".repeat(250)}@x.com`, "too-long"],
  ] as const)("rejects %j as %s", (input, error) => {
    expect(parseEmail(input)).toEqual({ ok: false, error });
  });

  it("is idempotent: parsing an accepted value again returns it unchanged", () => {
    fc.assert(
      fc.property(fc.emailAddress(), (raw) => {
        const first = parseEmail(raw);
        fc.pre(first.ok);
        if (first.ok) expect(parseEmail(first.value)).toEqual(first);
      }),
    );
  });

  it("never throws and always returns a tagged result", () => {
    fc.assert(
      fc.property(fc.anything(), (raw) => {
        expect(typeof parseEmail(raw).ok).toBe("boolean");
      }),
    );
  });
});
