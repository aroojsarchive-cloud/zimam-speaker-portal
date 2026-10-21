// Load test: N speakers hitting the live portal at the same moment.
// Each simulated speaker is signed in and loads their home, the agenda and a session page.
// Usage: npm run load -- 100
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 100);
const BASE = process.env.LIVE_SITE_URL!.replace(/\/$/, "");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });

async function cookieFor(email: string) {
  const jar = new Map<string, string>();
  const c = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) },
  });
  const { data } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  await c.auth.verifyOtp({ type: "email", token_hash: data.properties!.hashed_token });
  await c.rpc("claim_person");
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor((p / 100) * xs.length))];

async function main() {
  const [ev] = await sql`select id from events where slug = 'zimam-2026'`;
  // Temporary load-test speakers on real sessions, so each one has a real personal page.
  const sessions = await sql`select id from sessions where event_id = ${ev.id} and status = 'published' and session_type = 'speaking' order by start_time`;
  const tag = Date.now();
  const people: { id: string; email: string; session: string }[] = [];
  for (let i = 0; i < Math.min(N, 20); i++) {
    const email = `smoke-load-${tag}-${i}@example.org`;
    const [p] = await sql`insert into people (event_id, full_name) values (${ev.id}, ${`Load Test ${i}`}) returning id`;
    await sql`insert into people_private (person_id, email) values (${p.id}, ${email})`;
    const s = sessions[i % sessions.length];
    await sql`insert into assignments (person_id, session_id, role) values (${p.id}, ${s.id}, 'panelist')`;
    await admin.auth.admin.createUser({ email, email_confirm: true });
    people.push({ id: p.id, email, session: s.id });
  }
  try {
    console.log(`Signing in ${people.length} test speakers…`);
    const cookies = await Promise.all(people.map((p) => cookieFor(p.email)));

    // Warm-up so we measure steady state, not the first cold start.
    await Promise.all(cookies.slice(0, 5).map((c) => fetch(`${BASE}/`, { headers: { cookie: c } })));

    for (const round of [
      { name: `${N} speakers open the portal at once`, paths: (i: number) => ["/"] },
      { name: `${N} speakers open home, agenda and a session at once`, paths: (i: number) => ["/", "/agenda?tab=glance", `/sessions/${people[i % people.length].session}`] },
    ]) {
      const times: number[] = [];
      let errors = 0;
      const statuses = new Map<number, number>();
      const t0 = Date.now();
      await Promise.all(
        Array.from({ length: N }, async (_, i) => {
          const cookie = cookies[i % cookies.length];
          for (const path of round.paths(i)) {
            const s = Date.now();
            try {
              const res = await fetch(BASE + path, { headers: { cookie } });
              const body = await res.text();
              statuses.set(res.status, (statuses.get(res.status) ?? 0) + 1);
              const failed = res.status !== 200 || /data-dgst="(?!NEXT_)/.test(body);
              if (failed) errors++;
            } catch {
              errors++;
            }
            times.push(Date.now() - s);
          }
        }),
      );
      const total = Date.now() - t0;
      console.log(`\n${round.name}`);
      console.log(`  requests: ${times.length} in ${(total / 1000).toFixed(1)}s · errors: ${errors} · statuses: ${JSON.stringify(Object.fromEntries(statuses))}`);
      console.log(`  page time: median ${pct(times, 50)} ms · 95% under ${pct(times, 95)} ms · slowest ${Math.max(...times)} ms`);
    }
  } finally {
    await sql`delete from people where id = any(${people.map((p) => p.id)})`;
    for (const u of (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users)
      if (u.email?.startsWith(`smoke-load-${tag}`)) await admin.auth.admin.deleteUser(u.id);
    const [left] = await sql`select count(*)::int n from people_private where email like 'smoke-load-%'`;
    console.log(`\ncleanup: ${left.n} test people left`);
    await sql.end();
  }
}
main();
