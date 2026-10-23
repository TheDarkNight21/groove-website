import type { Email, Result } from "./email";

export type SupabaseConfig = {
  readonly url: string;
  readonly serviceRoleKey: string;
  readonly table: string;
};

export type WaitlistError =
  | { readonly kind: "not-configured"; readonly missing: readonly string[] }
  | { readonly kind: "upstream"; readonly status: number }
  | { readonly kind: "network" };

// Pure: reads config from a given env record, reports every missing variable at once.
export function readConfig(
  env: Readonly<Record<string, string | undefined>>,
): Result<SupabaseConfig, WaitlistError> {
  const url = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [
    ...(url ? [] : ["SUPABASE_URL"]),
    ...(serviceRoleKey ? [] : ["SUPABASE_SERVICE_ROLE_KEY"]),
  ];
  if (!url || !serviceRoleKey) {
    return { ok: false, error: { kind: "not-configured", missing } };
  }
  return {
    ok: true,
    value: { url, serviceRoleKey, table: env.WAITLIST_TABLE ?? "waitlist" },
  };
}

// Pure: describes the insert request without performing it.
export function insertRequest(config: SupabaseConfig, email: Email) {
  return {
    url: `${config.url.replace(/\/$/, "")}/rest/v1/${config.table}?on_conflict=email`,
    init: {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "Content-Type": "application/json",
        // An address that is already on the list counts as success.
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify({ email }),
    },
  } as const;
}

// Effect: the one place the network is touched. Failures come back as values.
export async function addToWaitlist(
  config: SupabaseConfig,
  email: Email,
  fetchImpl: typeof fetch = fetch,
): Promise<Result<null, WaitlistError>> {
  const { url, init } = insertRequest(config, email);
  try {
    const res = await fetchImpl(url, init);
    return res.ok
      ? { ok: true, value: null }
      : { ok: false, error: { kind: "upstream", status: res.status } };
  } catch {
    return { ok: false, error: { kind: "network" } };
  }
}
