import { describe, expect, it } from "vitest";
import type { Email } from "../email";
import { addToWaitlist, insertRequest, readConfig } from "../waitlist";

const email = "a@b.co" as Email;
const config = { url: "https://x.supabase.co/", anonKey: "k", table: "waitlist" };

describe("readConfig", () => {
  it("reports every missing variable at once", () => {
    expect(readConfig({})).toEqual({
      ok: false,
      error: { kind: "not-configured", missing: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] },
    });
  });

  it("defaults the table name", () => {
    expect(readConfig({ NEXT_PUBLIC_SUPABASE_URL: "u", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" })).toEqual({
      ok: true,
      value: { url: "u", anonKey: "k", table: "waitlist" },
    });
  });
});

describe("insertRequest", () => {
  it("targets the REST table with the key in apikey only, and sends only the email", () => {
    const { url, init } = insertRequest(config, email);
    expect(url).toBe("https://x.supabase.co/rest/v1/waitlist");
    expect(init.headers.apikey).toBe("k");
    expect("Authorization" in init.headers).toBe(false);
    expect(init.body).toBe('{"email":"a@b.co"}');
  });
});

describe("addToWaitlist", () => {
  it("returns ok on a 2xx", async () => {
    const f = (async () => new Response(null, { status: 201 })) as typeof fetch;
    expect(await addToWaitlist(config, email, f)).toEqual({ ok: true, value: null });
  });

  it("treats a duplicate (409) as already joined", async () => {
    const f = (async () => new Response(null, { status: 409 })) as typeof fetch;
    expect(await addToWaitlist(config, email, f)).toEqual({ ok: true, value: null });
  });

  it("returns the upstream status on failure", async () => {
    const f = (async () => new Response(null, { status: 401 })) as typeof fetch;
    expect(await addToWaitlist(config, email, f)).toEqual({
      ok: false,
      error: { kind: "upstream", status: 401 },
    });
  });

  it("turns a thrown network error into a value", async () => {
    const f = (async () => {
      throw new Error("down");
    }) as typeof fetch;
    expect(await addToWaitlist(config, email, f)).toEqual({ ok: false, error: { kind: "network" } });
  });
});
