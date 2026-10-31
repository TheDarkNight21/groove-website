import { ADMIN_COOKIE, ADMIN_COOKIE_MAX_AGE, MIN_TOKEN_LENGTH, sessionValue, tokenMatches } from "@/lib/orders/admin-auth";
import { env, missingEnvResponse } from "@/lib/orders/server";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const e = env(["ADMIN_TOKEN"]);
  if (!e.ok) return missingEnvResponse(e.error);
  if (e.value.ADMIN_TOKEN.length < MIN_TOKEN_LENGTH) {
    return new Response(`ADMIN_TOKEN must be at least ${MIN_TOKEN_LENGTH} characters.`, { status: 503 });
  }

  const form = await request.formData().catch(() => null);
  const token = form?.get("token");
  if (typeof token !== "string" || !tokenMatches(e.value.ADMIN_TOKEN, token.trim())) {
    return Response.redirect(`${origin}/admin/?error=token`, 303);
  }
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, sessionValue(e.value.ADMIN_TOKEN), {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_COOKIE_MAX_AGE,
  });
  return Response.redirect(`${origin}/admin/`, 303);
}
