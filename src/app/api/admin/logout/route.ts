import { ADMIN_COOKIE } from "@/lib/orders/admin-auth";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  (await cookies()).delete(ADMIN_COOKIE);
  return Response.redirect(`${new URL(request.url).origin}/admin/`, 303);
}
