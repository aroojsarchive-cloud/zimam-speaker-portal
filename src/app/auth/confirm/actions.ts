"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function confirmSignIn(tokenHash: string, next: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: "email", token_hash: tokenHash });
  if (error) redirect("/login?reason=expired");
  // Link this login to the person's record(s) and stamp last_login_at.
  await supabase.rpc("claim_person");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
