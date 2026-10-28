import { describe, expect, it } from "vitest";
import { callRpc, errorMessage, readConfig, rpcRequest } from "../supabase-rpc";

const config = { url: "https://x.supabase.co/", anonKey: "k" };

describe("readConfig", () => {
  it("reports every missing variable at once", () => {
    expect(readConfig({})).toEqual({
      ok: false,
      error: { kind: "not-configured", missing: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] },
    });
  });

  it("accepts a complete config", () => {
    expect(readConfig({ NEXT_PUBLIC_SUPABASE_URL: "u", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" })).toEqual({
      ok: true,
      value: { url: "u", anonKey: "k" },
    });
  });
});

describe("rpcRequest", () => {
  it("targets the named function under /rest/v1/rpc with the key in apikey only", () => {
    const { url, init } = rpcRequest(config, "do_thing", { a: 1 });
    expect(url).toBe("https://x.supabase.co/rest/v1/rpc/do_thing");
    expect(init.method).toBe("POST");
    expect(init.headers.apikey).toBe("k");
    expect("Authorization" in init.headers).toBe(false);
    expect(init.body).toBe('{"a":1}');
  });
});

describe("callRpc", () => {
  it("returns ok on a 2xx", async () => {
    const f = (async () => new Response(null, { status: 204 })) as typeof fetch;
    expect(await callRpc(config, "do_thing", {}, f)).toEqual({ ok: true, value: null });
  });

  it("returns the upstream status on failure", async () => {
    const f = (async () => new Response(null, { status: 401 })) as typeof fetch;
    expect(await callRpc(config, "do_thing", {}, f)).toEqual({ ok: false, error: { kind: "upstream", status: 401 } });
  });

  it("turns a thrown network error into a value", async () => {
    const f = (async () => {
      throw new Error("down");
    }) as typeof fetch;
    expect(await callRpc(config, "do_thing", {}, f)).toEqual({ ok: false, error: { kind: "network" } });
  });
});

describe("errorMessage", () => {
  it("uses the form's own line when it isn't configured", () => {
    expect(errorMessage({ kind: "not-configured", missing: ["X"] }, "The lab isn’t open yet.")).toBe(
      "The lab isn’t open yet.",
    );
  });
});
