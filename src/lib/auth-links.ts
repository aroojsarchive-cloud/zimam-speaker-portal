import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

/**
 * Builds a one-time sign-in link that lands on /auth/confirm. The token is only
 * spent when that page runs in a real browser, so corporate link scanners that
 * pre-open URLs in emails don't burn it.
 */
export async function createSignInLink(email: string, next = "/") {
  const admin = createAdminClient();
  // First sign-in: create the auth user (already-exists errors are expected and ignored).
  await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => undefined);
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error(error?.message ?? "Could not create sign-in link");
  const url = new URL("/auth/confirm", env.siteUrl());
  url.searchParams.set("token_hash", data.properties.hashed_token);
  url.searchParams.set("next", next.startsWith("/") ? next : "/");
  return url.toString();
}
