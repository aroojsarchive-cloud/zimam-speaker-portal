// Gives an email producer (admin) access to the event.
// Usage: npm run add-producer -- name@example.org ["Full Name"]
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import postgres from "postgres";

const email = process.argv[2]?.trim().toLowerCase();
const name = process.argv[3] ?? email?.split("@")[0];
if (!email?.includes("@")) {
  console.error('Usage: npm run add-producer -- name@example.org ["Full Name"]');
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
try {
  const [ev] = await sql`select id from events where slug = 'zimam-2026'`;
  const [existing] = await sql`select person_id from people_private where event_id = ${ev.id} and email = ${email}`;
  if (existing) {
    await sql`update people set app_role = 'producer' where id = ${existing.person_id}`;
    console.log(`${email} already existed; now a producer.`);
  } else {
    await sql.begin(async (tx) => {
      const [p] = await tx`insert into people (event_id, full_name, app_role, details_status)
                           values (${ev.id}, ${name}, 'producer', 'confirmed') returning id`;
      await tx`insert into people_private (person_id, email) values (${p.id}, ${email})`;
    });
    console.log(`${email} added as a producer.`);
  }
} finally {
  await sql.end();
}
