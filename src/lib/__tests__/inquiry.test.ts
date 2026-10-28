import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Email } from "../email";
import { MESSAGE_MAX_LENGTH, inquiryRequest, parseMessage, sendInquiry, type Message } from "../inquiry";

const email = "a@b.co" as Email;
const config = { url: "https://x.supabase.co", anonKey: "k" };

describe("parseMessage", () => {
  it("trims surrounding whitespace", () => {
    expect(parseMessage("  a sparkling tea \n")).toEqual({ ok: true, value: "a sparkling tea" });
  });

  it.each([
    ["", "empty"],
    ["   \n", "empty"],
    [undefined, "empty"],
    ["x".repeat(MESSAGE_MAX_LENGTH + 1), "too-long"],
  ] as const)("rejects %j as %s", (input, error) => {
    expect(parseMessage(input)).toEqual({ ok: false, error });
  });

  it("accepts exactly the maximum length", () => {
    expect(parseMessage("x".repeat(MESSAGE_MAX_LENGTH)).ok).toBe(true);
  });

  it("is idempotent: parsing an accepted value again returns it unchanged", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 50 }), (raw) => {
        const first = parseMessage(raw);
        fc.pre(first.ok);
        if (first.ok) expect(parseMessage(first.value)).toEqual(first);
      }),
    );
  });
});

describe("inquiryRequest", () => {
  it("calls the submit_lab_inquiry RPC with exactly the email and message", () => {
    const { url, init } = inquiryRequest(config, email, "a drink" as Message);
    expect(url).toBe("https://x.supabase.co/rest/v1/rpc/submit_lab_inquiry");
    expect(init.headers.apikey).toBe("k");
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.co", message: "a drink" });
  });
});

describe("sendInquiry", () => {
  it("returns ok on a 2xx", async () => {
    const f = (async () => new Response(null, { status: 204 })) as typeof fetch;
    expect(await sendInquiry(config, email, "a drink" as Message, f)).toEqual({ ok: true, value: null });
  });

  it("returns the upstream status on failure", async () => {
    const f = (async () => new Response(null, { status: 400 })) as typeof fetch;
    expect(await sendInquiry(config, email, "a drink" as Message, f)).toEqual({
      ok: false,
      error: { kind: "upstream", status: 400 },
    });
  });
});
