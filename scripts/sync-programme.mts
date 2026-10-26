// Updates the live programme from a revised programme file, keeping all speaker data.
// Usage: npm run sync -- seed/zimam-2026.json            (shows the changes, applies nothing)
//        npm run sync -- seed/zimam-2026.json --apply    (applies them, in one transaction)
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { syncProgramme } from "../src/lib/sync-programme";

const file = process.argv.find((a) => a.endsWith(".json"));
const apply = process.argv.includes("--apply");
if (!file) {
  console.error("Usage: npm run sync -- <programme.json> [--apply]");
  process.exit(1);
}
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
try {
  const raw = JSON.parse(readFileSync(file, "utf8"));
  const report = await sql.begin((tx) =>
    syncProgramme({ query: (q, params) => tx.unsafe(q, (params ?? []) as never[]) as never }, raw, { apply, aliases: raw.aliases ?? {} }),
  );
  console.log(`${apply ? "APPLIED" : "DRY RUN (nothing changed)"}: ${report.changes.length} changes`);
  console.log(JSON.stringify(report.counts));
  for (const c of report.changes) console.log("  " + c);
  if (report.warnings.length) console.log("\nCHECK:\n  " + report.warnings.join("\n  "));
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
