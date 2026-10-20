// Applies supabase/migrations/*.sql to DATABASE_URL in order, once each.
// Usage: npm run db:migrate
import { config } from "dotenv";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";

config({ path: ".env.local" });
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set in .env.local");
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, onnotice: () => {} });
const dir = join(import.meta.dirname, "../supabase/migrations");

try {
  await sql`create table if not exists public._migrations (name text primary key, applied_at timestamptz default now())`;
  await sql`alter table public._migrations enable row level security`;
  const done = new Set((await sql`select name from public._migrations`).map((r) => r.name as string));
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(file)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(join(dir, file), "utf8"));
      await tx`insert into public._migrations (name) values (${file})`;
    });
    console.log(`applied ${file}`);
  }
  console.log("Database is up to date.");
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
