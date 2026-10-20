import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signInAs } from "@/lib/auth-direct";
import { clientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";

// Personal invite link: /i/<token> signs that speaker straight in and opens their portal.
// Tokens are long-lived (they work until the producer resets them) and never grant producer access.
export async function GET(request: Request, ctx: RouteContext<"/i/[token]">) {
  const { token } = await ctx.params;
  const to = (path: string) => NextResponse.redirect(new URL(path, request.url));
  if (!/^[0-9a-f]{32}$/.test(token)) return to("/login?reason=bad-link");

  const ip = await clientIp();
  if (await isRateLimited(ip)) return to("/login?reason=bad-link");

  const { data } = await createAdminClient()
    .from("people_private")
    .select("email, people!inner(app_role, is_placeholder)")
    .eq("invite_token", token)
    .maybeSingle();
  const person = data?.people as unknown as { app_role: string; is_placeholder: boolean } | undefined;
  if (!data?.email || !person || person.is_placeholder || person.app_role === "producer") {
    await recordAttempt(ip, null, false);
    return to("/login?reason=bad-link");
  }

  try {
    await signInAs(data.email);
    await recordAttempt(ip, data.email, true);
  } catch (e) {
    console.error("invite link sign-in failed", e);
    return to("/login?reason=bad-link");
  }
  return to("/");
}
