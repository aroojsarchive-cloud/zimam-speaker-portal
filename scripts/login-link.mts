// Prints a one-time sign-in link for someone already in the portal (handy until email sending is set up).
// Usage: npm run login-link -- name@example.org [--live]
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run login-link -- name@example.org");
  process.exit(1);
}
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const { data: person } = await admin.from("people_private").select("person_id").eq("email", email).maybeSingle();
if (!person) {
  console.error(`${email} isn't in the portal. Add them first (producers: npm run add-producer -- ${email}).`);
  process.exit(1);
}
await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => undefined);
const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error || !data.properties?.hashed_token) throw error ?? new Error("no token");
const live = process.argv.includes("--live");
const site = ((live ? process.env.LIVE_SITE_URL : process.env.NEXT_PUBLIC_SITE_URL) ?? "http://localhost:3010").replace(/\/$/, "");
console.log(`${site}/auth/confirm?token_hash=${data.properties.hashed_token}&next=%2F`);
