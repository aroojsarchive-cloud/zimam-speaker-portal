import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { createClient } from "@supabase/supabase-js";

const email = process.env.P_EMAIL!.trim().toLowerCase();
const password = process.env.P_PW!;
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const { data: row } = await admin
  .from("people_private")
  .select("person_id, people!inner(app_role)")
  .eq("email", email)
  .eq("people.app_role", "producer")
  .maybeSingle();
if (!row) {
  console.log(`✗ ${email} isn't a producer. Add them first: npm run add-producer -- ${email}`);
  process.exit(1);
}
const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
if (created.error) {
  // Already exists: find and update.
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    console.log("✗ Couldn't find that login. Tell Claude.");
    process.exit(1);
  }
  const { error } = await admin.auth.admin.updateUserById(user.id, { password });
  if (error) {
    console.log(`✗ ${error.message}`);
    process.exit(1);
  }
}
console.log(`✓ Password set for ${email}. Sign in with your email, then this password.`);
