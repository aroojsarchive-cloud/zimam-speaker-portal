// Removes every piece of example/test data before real speakers sign in:
// example emails, the sample + test briefs, test slide uploads, placeholder contact details,
// example check/confirm/review states. Usage: npm run demo:clear
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

try {
  const demo = await sql`select pp.person_id, p.full_name from people_private pp join people p on p.id = pp.person_id where pp.email like '%@example.org'`;
  const ids = demo.map((d) => d.person_id as string);
  if (ids.length) {
    const slides = await sql`select file_path from slide_submissions where person_id = any(${ids})`;
    if (slides.length) await admin.storage.from("slides").remove(slides.map((s) => s.file_path as string));
    await sql`delete from slide_submissions where person_id = any(${ids})`;
    await sql`update assignments set reviewed_at = null, no_slides = false, slides_sent_at = null, checked_in_at = null where person_id = any(${ids})`;
    await sql`update people set details_status = 'unconfirmed', details_confirmed_at = null, guidelines_ack_at = null, photo_path = null, auth_user_id = null where id = any(${ids})`;
    await sql`update people_private set email = null, last_login_at = null, last_seen_changes_at = null, change_request_note = null where person_id = any(${ids})`;
    for (const u of (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users)
      if (u.email?.endsWith("@example.org")) await admin.auth.admin.deleteUser(u.id);
  }
  // Sample brief (HIE Panel 1) and any brief containing "(Test brief.)".
  const notes = await sql`delete from concept_notes where summary like '%(Test brief.)%' or session_id in
    (select id from sessions where title like 'HIE Maturity Models%') returning id`;
  await sql`update events set producer_phone = null, producer_whatsapp = null where producer_phone = '+971 50 000 0000'`;
  console.log(`Cleared example data for: ${demo.map((d) => d.full_name).join(", ") || "nobody"}; removed ${notes.length} sample brief rows.`);
  console.log("Remember to set the real producer contact (name, WhatsApp, phone).");
} finally {
  await sql.end();
}
