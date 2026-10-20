import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Signs the current browser in as `email` without sending anything: a one-time
 * token is minted server-side and immediately exchanged for a session cookie.
 * Only call this after deciding the person is allowed in (speaker email match,
 * personal invite link, or producer password).
 */
export async function signInAs(email: string) {
  const admin = createAdminClient();
  await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => undefined);
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) throw new Error(error?.message ?? "Could not start a session");

  const supabase = await createClient();
  const { error: verifyError } = await supabase.auth.verifyOtp({ type: "email", token_hash: data.properties.hashed_token });
  if (verifyError) throw new Error(verifyError.message);
  await supabase.rpc("claim_person");
}
