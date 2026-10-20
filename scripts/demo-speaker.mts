// Sets up an example speaker so the speaker experience can be previewed:
// Dr Juliet Ibrahim (2 sessions) with an example email, one published brief,
// and example producer contact details. Safe to re-run.
// Usage: npm run demo
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import postgres from "postgres";

export const DEMO_EMAIL = "juliet.ibrahim@example.org";
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

try {
  const [ev] = await sql`select id from events where slug = 'zimam-2026'`;
  const [juliet] = await sql`select id from people where event_id = ${ev.id} and full_name = 'Juliet Ibrahim'`;
  await sql`update people_private set email = ${DEMO_EMAIL}, last_seen_changes_at = now() - interval '3 days' where person_id = ${juliet.id}`;

  // Example moderator (Panel 4) for previewing the brief editor.
  const [justin] = await sql`select id from people where event_id = ${ev.id} and full_name = 'Justin Thomas'`;
  await sql`update people_private set email = 'justin.thomas@example.org' where person_id = ${justin.id}`;

  console.log(`Example speaker ready: Dr Juliet Ibrahim <${DEMO_EMAIL}>; example moderator: Dr Justin Thomas <justin.thomas@example.org>. Get a link with: npm run login-link -- ${DEMO_EMAIL}`);
} finally {
  await sql.end();
}
