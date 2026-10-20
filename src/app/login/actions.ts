"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { signInAs } from "@/lib/auth-direct";
import { clientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";
import { getPublicEventInfo } from "@/lib/event";

export type LoginState =
  | { status: "idle" }
  | { status: "unknown"; email: string }
  | { status: "password"; email: string; wrong?: boolean }
  | { status: "error"; message: string };

const TOO_MANY = "Too many attempts. Please wait 15 minutes and try again.";

/**
 * Speakers sign in with just their email: it's their username, no password.
 * Producers (who control everything) also need their password.
 */
export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!parsed.success) return { status: "error", message: "That doesn't look like an email address." };
  const email = parsed.data;
  const password = String(form.get("password") ?? "");

  try {
    const ip = await clientIp();
    if (await isRateLimited(ip)) return { status: "error", message: TOO_MANY };

    const event = await getPublicEventInfo();
    if (!event.id) return { status: "error", message: "The portal isn't open yet. Please try again later." };

    const { data: match } = await createAdminClient()
      .from("people_private")
      .select("person_id, people!inner(app_role, is_placeholder)")
      .eq("event_id", event.id)
      .eq("email", email)
      .eq("people.is_placeholder", false)
      .maybeSingle();
    if (!match) {
      await recordAttempt(ip, email, false);
      return { status: "unknown", email };
    }

    const role = (match.people as unknown as { app_role: string }).app_role;
    if (role === "producer") {
      if (!password) return { status: "password", email };
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        await recordAttempt(ip, email, false);
        return { status: "password", email, wrong: true };
      }
      await supabase.rpc("claim_person");
    } else {
      await signInAs(email);
    }
    await recordAttempt(ip, email, true);
  } catch (e) {
    console.error("sign-in failed", e);
    return { status: "error", message: "We couldn't sign you in just now. Please try again in a minute." };
  }
  redirect("/");
}
