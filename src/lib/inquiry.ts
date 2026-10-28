import type { Email, Result } from "./email";
import { callRpc, errorMessage as rpcErrorMessage, rpcRequest, type RpcError, type SupabaseConfig } from "./supabase-rpc";

// A brand's "what are you making" note, saved through submit_lab_inquiry.
const FN = "submit_lab_inquiry";

// Mirrors the check constraint on lab_inquiries.message.
export const MESSAGE_MAX_LENGTH = 2000;

export type Message = string & { readonly __brand: "Message" };
export type MessageError = "empty" | "too-long";

// Smart constructor: the only way to get a Message.
export function parseMessage(raw: unknown): Result<Message, MessageError> {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (trimmed === "") return { ok: false, error: "empty" };
  if (trimmed.length > MESSAGE_MAX_LENGTH) return { ok: false, error: "too-long" };
  return { ok: true, value: trimmed as Message };
}

export const inquiryRequest = (config: SupabaseConfig, email: Email, message: Message) =>
  rpcRequest(config, FN, { email, message });

export const sendInquiry = (
  config: SupabaseConfig,
  email: Email,
  message: Message,
  fetchImpl: typeof fetch = fetch,
): Promise<Result<null, RpcError>> => callRpc(config, FN, { email, message }, fetchImpl);

export const errorMessage = (error: RpcError) => rpcErrorMessage(error, "The lab isn’t taking inquiries yet.");
