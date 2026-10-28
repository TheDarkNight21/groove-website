import type { Email, Result } from "./email";
import {
  callRpc,
  errorMessage as rpcErrorMessage,
  rpcRequest,
  type RpcError,
  type SupabaseConfig,
} from "./supabase-rpc";

// Joining calls join_waitlist, which answers identically for new and existing
// addresses so the public key can't be used to probe the list.
const FN = "join_waitlist";

export type WaitlistError = RpcError;
export type { SupabaseConfig };
export { publicConfig, readConfig } from "./supabase-rpc";

export const insertRequest = (config: SupabaseConfig, email: Email) => rpcRequest(config, FN, { email });

export const addToWaitlist = (
  config: SupabaseConfig,
  email: Email,
  fetchImpl: typeof fetch = fetch,
): Promise<Result<null, WaitlistError>> => callRpc(config, FN, { email }, fetchImpl);

export const errorMessage = (error: WaitlistError) => rpcErrorMessage(error, "The waitlist isn’t open yet.");
