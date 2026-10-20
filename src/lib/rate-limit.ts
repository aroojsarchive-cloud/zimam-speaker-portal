import "server-only";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

const WINDOW_MIN = 15;
// Only failed attempts count: at the venue every speaker shares one Wi-Fi address,
// so successful sign-ins must never lock anyone out.
const MAX_FAILED = 25;

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Stops anyone trying email after email to find out who's speaking. */
export async function isRateLimited(ip: string) {
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const { count } = await createAdminClient()
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .eq("ok", false)
    .gte("at", since);
  return (count ?? 0) >= MAX_FAILED;
}

export async function recordAttempt(ip: string, email: string | null, ok: boolean) {
  await createAdminClient().from("login_attempts").insert({ ip, email, ok });
}
