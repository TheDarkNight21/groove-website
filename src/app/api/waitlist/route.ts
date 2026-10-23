import { parseEmail } from "@/lib/email";
import { addToWaitlist, readConfig } from "@/lib/waitlist";

const reply = (status: number, message: string) =>
  Response.json({ ok: status < 300, message }, { status });

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const email = parseEmail(
    typeof body === "object" && body !== null && "email" in body
      ? (body as { email: unknown }).email
      : undefined,
  );
  if (!email.ok) return reply(400, "Enter a valid email address.");

  const config = readConfig(process.env);
  if (!config.ok) {
    const missing =
      config.error.kind === "not-configured" ? config.error.missing.join(", ") : "";
    console.error(`waitlist: not configured, missing ${missing}`);
    return reply(503, "The waitlist isn’t open yet.");
  }

  const saved = await addToWaitlist(config.value, email.value);
  if (!saved.ok) {
    console.error("waitlist: insert failed", saved.error);
    return reply(502, "Something went wrong. Try again in a moment.");
  }
  return reply(200, "You’re on the list.");
}
