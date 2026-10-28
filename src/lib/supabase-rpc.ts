import type { Result } from "./email";

// The site is a static export (no server), so the browser writes to Supabase
// directly with the public key. Every write goes through a SECURITY DEFINER
// function (see supabase/migrations); the tables themselves are closed.

export type SupabaseConfig = {
  readonly url: string;
  readonly anonKey: string;
};

export type RpcError =
  | { readonly kind: "not-configured"; readonly missing: readonly string[] }
  | { readonly kind: "upstream"; readonly status: number }
  | { readonly kind: "network" };

type PublicEnv = {
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
};

// Next only inlines NEXT_PUBLIC_* values written out literally, so the edge builds
// this record by hand; this function just validates it, reporting all gaps at once.
export function readConfig(env: PublicEnv): Result<SupabaseConfig, RpcError> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    const missing = [
      ...(url ? [] : ["NEXT_PUBLIC_SUPABASE_URL"]),
      ...(anonKey ? [] : ["NEXT_PUBLIC_SUPABASE_ANON_KEY"]),
    ];
    return { ok: false, error: { kind: "not-configured", missing } };
  }
  return { ok: true, value: { url, anonKey } };
}

export const publicConfig = () =>
  readConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

// Pure: describes the call to a Postgres function without performing it.
export function rpcRequest(config: SupabaseConfig, fn: string, body: Record<string, unknown>) {
  return {
    url: `${config.url.replace(/\/$/, "")}/rest/v1/rpc/${fn}`,
    init: {
      method: "POST",
      headers: {
        // Publishable keys (sb_publishable_…) go in apikey only; they aren't JWTs.
        apikey: config.anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  } as const;
}

// Effect: the one place the network is touched. Failures come back as values.
export async function callRpc(
  config: SupabaseConfig,
  fn: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<Result<null, RpcError>> {
  const { url, init } = rpcRequest(config, fn, body);
  try {
    const res = await fetchImpl(url, init);
    return res.ok
      ? { ok: true, value: null }
      : { ok: false, error: { kind: "upstream", status: res.status } };
  } catch {
    return { ok: false, error: { kind: "network" } };
  }
}

// Each form says in its own words what "not configured" means to a visitor.
export function errorMessage(error: RpcError, notConfigured: string): string {
  switch (error.kind) {
    case "not-configured":
      return notConfigured;
    case "upstream":
      return "Something went wrong. Try again in a moment.";
    case "network":
      return "Couldn’t reach the server. Check your connection.";
    default: {
      const never: never = error;
      return never;
    }
  }
}
