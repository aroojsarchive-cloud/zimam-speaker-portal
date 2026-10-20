// Usage: npm run import -- seed/zimam-2026.json [--replace]
// Imports a programme file into the database at DATABASE_URL, in one transaction.
import { config } from "dotenv";
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { importProgramme } from "../src/lib/import-programme";

config({ path: ".env.local" });

const file = process.argv.find((a) => a.endsWith(".json"));
const replace = process.argv.includes("--replace");
if (!file) {
  console.error("Usage: npm run import -- <programme.json> [--replace]");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });

// --replace deletes the whole event. Once real speakers have emails, logins, progress,
// slides or briefs, refuse unless --wipe-everything is also given.
if (replace) {
  const [r] = await sql`
    select
      (select count(*) from people_private pp join events e on e.id = pp.event_id
        where e.slug = 'zimam-2026' and pp.email is not null and pp.email not like '%@example.org'
          and pp.person_id not in (select id from people where app_role = 'producer'))::int as emails,
      (select count(*) from slide_submissions)::int as slides,
      (select count(*) from concept_notes where kind = 'published')::int as briefs`;
  if ((r.emails || r.slides || r.briefs) && !process.argv.includes("--wipe-everything")) {
    console.error(
      `✗ Refusing to replace: the live event has ${r.emails} speaker emails, ${r.slides} slide uploads and ${r.briefs} published briefs.\n` +
        "  Replacing would delete all of it. Edit the programme on the producer pages instead,\n" +
        "  or add --wipe-everything if you really mean to start again.",
    );
    await sql.end();
    process.exit(1);
  }
}
const producerEmails = (process.env.PRODUCER_EMAILS ?? "").split(",").map((e) => e.trim()).filter(Boolean);

try {
  const result = await sql.begin((tx) =>
    importProgramme(
      { query: (q, params) => tx.unsafe(q, (params ?? []) as never[]) as never },
      JSON.parse(readFileSync(file, "utf8")),
      { replace, producerEmails },
    ),
  );
  console.log(
    `Imported ${result.sessions} sessions, ${result.people} people, ${result.placeholders} TBC slots, ` +
      `${result.assignments} assignments. Producers: ${producerEmails.join(", ") || "none (set PRODUCER_EMAILS)"}`,
  );
  console.log(`\n${result.flags.length} things for the producer to resolve:`);
  for (const f of result.flags) console.log(`  • ${f}`);
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
