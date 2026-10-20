#!/bin/bash
# Asks for the Supabase database password (hidden), checks it works, then saves
# the full connection string into .env.local.
cd "$(dirname "$0")/.." || exit 1
echo ""
echo "Type (or paste) ONLY your database password. Nothing will show as you type."
read -r -s -p "Database password: " PW; echo
[ -z "$PW" ] && { echo "Nothing entered."; exit 1; }
DB_PASSWORD="$PW" node --input-type=module -e '
import postgres from "postgres";
import { readFileSync, writeFileSync } from "node:fs";
const pw = process.env.DB_PASSWORD;
const url = `postgresql://postgres.cnvynahogonzvdapxoxo:${encodeURIComponent(pw)}@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;
const sql = postgres(url, { max: 1, connect_timeout: 10, prepare: false });
try {
  await sql`select 1`;
} catch (e) {
  console.log(/password/i.test(e.message)
    ? "\n✗ That password was not accepted. Run this again, or reset it in Supabase: Project Settings → Database → Reset database password."
    : "\n✗ Could not connect: " + e.message);
  process.exit(1);
} finally { await sql.end({ timeout: 1 }); }
const env = readFileSync(".env.local", "utf8").split("\n").map((l) => l.startsWith("DATABASE_URL=") ? "DATABASE_URL=" + url : l).join("\n");
writeFileSync(".env.local", env);
console.log("\n✓ Password works and is saved. Go back to Claude and say \"done\".");
'
