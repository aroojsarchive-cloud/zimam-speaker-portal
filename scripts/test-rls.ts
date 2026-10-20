// Runs the real migrations against an in-memory Postgres (PGlite) with a minimal
// stand-in for Supabase's auth/storage schemas, then checks every permission rule
// from the spec. Run with: npm run test:rls
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { importProgramme } from "../src/lib/import-programme";

const SUPABASE_STUB = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create publication supabase_realtime;
grant usage on schema public, storage, auth to anon, authenticated;
`;

const GRANTS = `
grant select, insert, update, delete on all tables in schema public to anon, authenticated; -- Supabase default
grant select, insert, update on storage.objects to authenticated;
`;

let failures = 0;
let passes = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) passes++;
  else {
    failures++;
    console.log(`  ✗ ${name}`, detail ?? "");
  }
}

async function main() {
  const db = new PGlite({ extensions: { citext } });
  await db.exec(SUPABASE_STUB);
  const dir = join(import.meta.dirname, "../supabase/migrations");
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));
  await db.exec(GRANTS);

  // ── Fixture: one event, one track, three sessions, five people ──
  const ids = {
    ev: "00000000-0000-0000-0000-0000000000e1",
    otherEv: "00000000-0000-0000-0000-0000000000e2",
    producerU: "00000000-0000-0000-0000-00000000a001",
    modU: "00000000-0000-0000-0000-00000000a002",
    spkU: "00000000-0000-0000-0000-00000000a003",
    viewerU: "00000000-0000-0000-0000-00000000a004",
    strangerU: "00000000-0000-0000-0000-00000000a005",
  };
  await db.exec(`
    insert into events (id, name, slug, start_date, end_date, venue) values
      ('${ids.ev}', 'Test', 'test', '2026-11-04', '2026-11-06', 'Venue'),
      ('${ids.otherEv}', 'Other', 'other', '2026-11-04', '2026-11-06', 'Venue');
    insert into days (id, event_id, date, label) values
      ('00000000-0000-0000-0000-0000000000d1', '${ids.ev}', '2026-11-04', 'Forum Day');
    insert into tracks (id, day_id, name, room) values
      ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000d1', 'HIE Summit', 'Room 2');
    insert into sessions (id, track_id, start_time, end_time, sequence, title, format, session_type, status) values
      ('00000000-0000-0000-0000-0000000005a1', '00000000-0000-0000-0000-0000000000f1', '2026-11-04 10:00+04', '2026-11-04 10:40+04', 1, 'Panel A', 'panel', 'speaking', 'published'),
      ('00000000-0000-0000-0000-0000000005a2', '00000000-0000-0000-0000-0000000000f1', '2026-11-04 10:40+04', '2026-11-04 11:00+04', 2, 'Coffee', 'break', 'non_speaking', 'published'),
      ('00000000-0000-0000-0000-0000000005a3', '00000000-0000-0000-0000-0000000000f1', '2026-11-04 11:00+04', '2026-11-04 11:30+04', 3, 'Secret draft', 'panel', 'speaking', 'draft');
    insert into people (id, event_id, full_name, app_role, auth_user_id) values
      ('00000000-0000-0000-0000-0000000000b1', '${ids.ev}', 'Producer', 'producer', '${ids.producerU}'),
      ('00000000-0000-0000-0000-0000000000b2', '${ids.ev}', 'Moderator', 'participant', '${ids.modU}'),
      ('00000000-0000-0000-0000-0000000000b3', '${ids.ev}', 'Speaker', 'participant', '${ids.spkU}'),
      ('00000000-0000-0000-0000-0000000000b4', '${ids.ev}', 'Designer', 'viewer', '${ids.viewerU}'),
      ('00000000-0000-0000-0000-0000000000b5', '${ids.ev}', 'Unclaimed Speaker', 'participant', null),
      ('00000000-0000-0000-0000-0000000000b6', '${ids.ev}', 'Industry partner (TBC)', 'participant', null);
    update people set is_placeholder = true where id = '00000000-0000-0000-0000-0000000000b6';
    insert into people_private (person_id, email, phone) values
      ('00000000-0000-0000-0000-0000000000b2', 'mod@x.org', '+971 1'),
      ('00000000-0000-0000-0000-0000000000b3', 'spk@x.org', '+971 2'),
      ('00000000-0000-0000-0000-0000000000b5', 'New.Person@X.org', '+971 3');
    insert into assignments (person_id, session_id, role, status) values
      ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000005a1', 'moderator', 'confirmed'),
      ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000005a1', 'panelist', 'confirmed'),
      ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-0000000005a3', 'panelist', 'invited');
    insert into concept_notes (session_id, kind, summary) values
      ('00000000-0000-0000-0000-0000000005a1', 'draft', 'half-finished draft');
    insert into session_internal_notes (session_id, notes) values
      ('00000000-0000-0000-0000-0000000005a1', 'producer only');
  `);

  async function as<T>(userId: string | null, email: string | null, fn: () => Promise<T>): Promise<T | Error> {
    await db.exec(`begin`);
    try {
      if (userId) {
        await db.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true)`,
          [userId, JSON.stringify({ sub: userId, email })]);
        await db.exec(`set local role authenticated`);
      } else await db.exec(`set local role anon`);
      const r = await fn();
      await db.exec(`commit`);
      return r;
    } catch (e) {
      await db.exec(`rollback`);
      return e as Error;
    }
  }
  const rows = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows as Record<string, unknown>[];
  const count = async (sql: string) => (await rows(sql)).length;

  console.log("Speaker");
  await as(ids.spkU, "spk@x.org", async () => {
    check("sees published sessions only", (await count(`select * from sessions`)) === 2);
    check("cannot see draft session", (await count(`select * from sessions where title = 'Secret draft'`)) === 0);
    check("sees break rows in running order", (await count(`select * from sessions where session_type = 'non_speaking'`)) === 1);
    check("cannot see draft brief", (await count(`select * from concept_notes`)) === 0);
    check("cannot see internal notes", (await count(`select * from session_internal_notes`)) === 0);
    check("sees only own private row", (await count(`select * from people_private`)) === 1);
    check("sees public profiles", (await count(`select * from people`)) === 6);
    check("cannot see assignments of draft session",
      (await count(`select * from assignments where session_id = '00000000-0000-0000-0000-0000000005a3'`)) === 0);
    check("cannot see change log", (await count(`select * from change_log`)) === 0);
  });
  check("speaker cannot edit own name directly",
    ((await as(ids.spkU, "spk@x.org", () => rows(`update people set full_name = 'Hacked' where id = '00000000-0000-0000-0000-0000000000b3' returning id`))) as unknown[]).length === 0);
  check("speaker cannot edit a session",
    ((await as(ids.spkU, "spk@x.org", () => rows(`update sessions set title = 'x' returning id`))) as unknown[]).length === 0);
  check("speaker cannot write a draft brief",
    (await as(ids.spkU, "spk@x.org", () => rows(`insert into concept_notes (session_id, kind) values ('00000000-0000-0000-0000-0000000005a2', 'draft')`))) instanceof Error);
  check("speaker cannot publish a brief",
    (await as(ids.spkU, "spk@x.org", () => rows(`select publish_brief('00000000-0000-0000-0000-0000000005a1')`))) instanceof Error);
  check("speaker can confirm own details",
    !((await as(ids.spkU, "spk@x.org", () => rows(`select confirm_details('00000000-0000-0000-0000-0000000000b3')`))) instanceof Error));
  check("speaker cannot confirm someone else's details",
    (await as(ids.spkU, "spk@x.org", () => rows(`select confirm_details('00000000-0000-0000-0000-0000000000b2')`))) instanceof Error);
  check("speaker can flag a change",
    !((await as(ids.spkU, "spk@x.org", () => rows(`select request_details_change('00000000-0000-0000-0000-0000000000b3', 'Title is wrong')`))) instanceof Error));
  check("check-in refused outside the event day",
    (await as(ids.spkU, "spk@x.org", async () => {
      const [a] = await rows(`select id from assignments where role = 'panelist' limit 1`);
      return rows(`select check_in($1)`, [a.id]);
    })) instanceof Error);
  check("speaker can upload own photo",
    !((await as(ids.spkU, "spk@x.org", () => rows(`insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-0000-0000-0000000000b3/me.jpg')`))) instanceof Error));
  check("speaker cannot upload someone else's photo",
    (await as(ids.spkU, "spk@x.org", () => rows(`insert into storage.objects (bucket_id, name) values ('photos', '00000000-0000-0000-0000-0000000000b2/me.jpg')`))) instanceof Error);

  console.log("Moderator");
  await as(ids.modU, "mod@x.org", async () => {
    check("sees draft brief of own session", (await count(`select * from concept_notes where kind = 'draft'`)) === 1);
    check("can edit draft brief",
      (await rows(`update concept_notes set summary = 'better' where kind = 'draft' returning id`)).length === 1);
    const r = await rows(`select publish_brief('00000000-0000-0000-0000-0000000005a1') as v`);
    check("publish creates version 1", r[0].v === 1, r);
    const r2 = await rows(`select publish_brief('00000000-0000-0000-0000-0000000005a1') as v`);
    check("republish bumps version", r2[0].v === 2, r2);
    check("cannot edit published copy directly",
      (await rows(`update concept_notes set summary = 'x' where kind = 'published' returning id`)).length === 0);
    check("cannot see other people's email", (await count(`select * from people_private`)) === 1);
  });
  check("moderator cannot draft a session they don't moderate",
    (await as(ids.modU, "mod@x.org", () => rows(`insert into concept_notes (session_id, kind) values ('00000000-0000-0000-0000-0000000005a2', 'draft')`))) instanceof Error);
  check("moderator can upload a brief file for own session",
    !((await as(ids.modU, "mod@x.org", () => rows(`insert into storage.objects (bucket_id, name) values ('briefs', '00000000-0000-0000-0000-0000000005a1/brief.pdf')`))) instanceof Error));

  console.log("Speaker after publish");
  await as(ids.spkU, "spk@x.org", async () => {
    const r = await rows(`select summary, version from concept_notes`);
    check("sees published brief only", r.length === 1 && r[0].summary === "better" && r[0].version === 2, r);
    check("can read brief file", (await count(`select * from storage.objects where bucket_id = 'briefs'`)) === 1);
  });

  console.log("Producer");
  await as(ids.producerU, "p@x.org", async () => {
    check("sees all sessions incl. drafts", (await count(`select * from sessions`)) === 3);
    check("sees all private rows", (await count(`select * from people_private`)) === 3);
    check("sees internal notes", (await count(`select * from session_internal_notes`)) === 1);
    await rows(`update sessions set start_time = '2026-11-04 10:05+04' where title = 'Panel A'`);
    const log = await rows(`select field, session_id from change_log where entity = 'sessions'`);
    check("session edit lands in change log", log.length === 1 && log[0].field === "start_time", log);
    check("producer sees publish in change log",
      (await count(`select * from change_log where entity = 'concept_notes'`)) >= 1);
  });

  console.log("Viewer, stranger, anon");
  await as(ids.viewerU, "v@x.org", async () => {
    check("viewer sees roster", (await count(`select * from people`)) === 6);
    check("viewer sees no emails", (await count(`select * from people_private`)) === 0);
    check("viewer sees no drafts", (await count(`select * from sessions`)) === 2);
  });
  check("viewer cannot edit sessions",
    ((await as(ids.viewerU, "v@x.org", () => rows(`update sessions set title = 'x' returning id`))) as unknown[]).length === 0);
  await as(ids.strangerU, "nobody@x.org", async () => {
    check("signed-in stranger sees nothing", (await count(`select * from sessions`)) + (await count(`select * from people`)) === 0);
  });
  const anon = await as(null, null, () => rows(`select * from sessions`));
  check("anon sees nothing (no error)", Array.isArray(anon) && anon.length === 0, anon);

  console.log("Invite links and login attempts");
  await as(ids.spkU, "spk@x.org", async () => {
    const t = await rows(`select invite_token from people_private`);
    check("speaker sees only their own invite token", t.length === 1 && typeof t[0].invite_token === "string" && (t[0].invite_token as string).length === 32, t);
    check("speakers cannot read login attempts", (await count(`select * from login_attempts`)) === 0);
  });
  await as(ids.producerU, "p@x.org", async () => {
    check("producer sees every invite token", (await count(`select * from people_private where invite_token is not null`)) === 3);
  });
  const tokens = await rows(`select count(distinct invite_token)::int as n, count(*)::int as total from people_private`);
  check("invite tokens are unique", tokens[0].n === tokens[0].total, tokens);

  console.log("Slides");
  const panelA = "00000000-0000-0000-0000-0000000005a1";
  const coffee = "00000000-0000-0000-0000-0000000005a2";
  const spk = "00000000-0000-0000-0000-0000000000b3";
  check("speaker can submit slides to own session",
    !((await as(ids.spkU, "spk@x.org", () => rows(`insert into slide_submissions (session_id, person_id, file_path, file_name) values ('${panelA}', '${spk}', '${panelA}/${spk}/deck.pptx', 'deck.pptx')`))) instanceof Error));
  check("speaker can upload the slide file to own folder",
    !((await as(ids.spkU, "spk@x.org", () => rows(`insert into storage.objects (bucket_id, name) values ('slides', '${panelA}/${spk}/deck.pptx')`))) instanceof Error));
  check("speaker cannot submit to a session they're not on",
    (await as(ids.spkU, "spk@x.org", () => rows(`insert into slide_submissions (session_id, person_id, file_path, file_name) values ('${coffee}', '${spk}', 'x', 'x')`))) instanceof Error);
  check("speaker cannot submit as someone else",
    (await as(ids.spkU, "spk@x.org", () => rows(`insert into slide_submissions (session_id, person_id, file_path, file_name) values ('${panelA}', '00000000-0000-0000-0000-0000000000b2', 'x', 'x')`))) instanceof Error);
  check("speaker cannot upload into someone else's slide folder",
    (await as(ids.spkU, "spk@x.org", () => rows(`insert into storage.objects (bucket_id, name) values ('slides', '${panelA}/00000000-0000-0000-0000-0000000000b2/x.pptx')`))) instanceof Error);
  await as(ids.modU, "mod@x.org", async () => {
    check("moderator sees the session's slides", (await count(`select * from slide_submissions`)) === 1);
    check("moderator can open the slide file", (await count(`select * from storage.objects where bucket_id = 'slides'`)) === 1);
  });
  await as(ids.viewerU, "v@x.org", async () => {
    check("others cannot see slides", (await count(`select * from slide_submissions`)) + (await count(`select * from storage.objects where bucket_id = 'slides'`)) === 0);
  });
  await as(ids.producerU, "p@x.org", async () => {
    check("producer sees all slides", (await count(`select * from slide_submissions`)) === 1);
  });

  console.log("Preparation steps");
  const spkAssign = (await rows(`select id from assignments where person_id = '${spk}' and session_id = '${panelA}'`))[0].id as string;
  const modAssign = (await rows(`select id from assignments where role = 'moderator' limit 1`))[0].id as string;
  check("speaker can mark own session reviewed",
    !((await as(ids.spkU, "spk@x.org", () => rows(`select mark_session_reviewed($1)`, [spkAssign]))) instanceof Error));
  check("speaker can say they're not using slides",
    !((await as(ids.spkU, "spk@x.org", () => rows(`select set_no_slides($1, true)`, [spkAssign]))) instanceof Error));
  check("speaker cannot mark someone else's session reviewed",
    (await as(ids.spkU, "spk@x.org", () => rows(`select mark_session_reviewed($1)`, [modAssign]))) instanceof Error);
  const st = await rows(`select reviewed_at is not null as r, no_slides from assignments where id = $1`, [spkAssign]);
  check("review and no-slides are saved", st[0].r === true && st[0].no_slides === true, st);
  check("speaker cannot edit assignments directly",
    ((await as(ids.spkU, "spk@x.org", () => rows(`update assignments set status = 'confirmed' where id = '${modAssign}' returning id`))) as unknown[]).length === 0);

  console.log("Photo after a change request");
  await as(ids.spkU, "spk@x.org", () => rows(`select request_details_change('${spk}', 'Wrong title')`));
  await as(ids.spkU, "spk@x.org", () => rows(`select set_my_photo('${spk}', '${spk}/new.jpg')`));
  const afterPhoto = await rows(`select details_status from people where id = '${spk}'`);
  check("a new photo keeps an open change request", afterPhoto[0].details_status === "change_requested", afterPhoto);
  await as(ids.spkU, "spk@x.org", () => rows(`select confirm_details('${spk}')`));
  await as(ids.spkU, "spk@x.org", () => rows(`select set_my_photo('${spk}', '${spk}/newer.jpg')`));
  const reconfirm = await rows(`select details_status from people where id = '${spk}'`);
  check("a new photo after confirming asks to re-confirm", reconfirm[0].details_status === "unconfirmed", reconfirm);

  console.log("Guidelines");
  check("speaker can acknowledge the guidelines",
    !((await as(ids.spkU, "spk@x.org", () => rows(`select acknowledge_guidelines('${spk}')`))) instanceof Error));
  check("speaker cannot acknowledge for someone else",
    (await as(ids.spkU, "spk@x.org", () => rows(`select acknowledge_guidelines('00000000-0000-0000-0000-0000000000b2')`))) instanceof Error);

  console.log("Login linking");
  const newU = "00000000-0000-0000-0000-00000000a006";
  const claimed = await as(newU, "new.person@x.org", () => rows(`select * from claim_person()`));
  check("first sign-in links person by email (case-insensitive)", Array.isArray(claimed) && claimed.length === 1, claimed);
  await as(newU, "new.person@x.org", async () => {
    check("linked person sees the agenda", (await count(`select * from sessions`)) === 2);
  });
  const stolen = await as(ids.strangerU, "spk@x.org", () => rows(`select * from claim_person()`));
  check("cannot claim a person already linked to another account", Array.isArray(stolen) && stolen.length === 0, stolen);

  console.log("Programme import");
  const seed = JSON.parse(readFileSync(join(import.meta.dirname, "../seed/zimam-2026.json"), "utf8"));
  const res = await importProgramme({ query: (q, p) => rows(q, p) as never }, seed, { producerEmails: ["Producer@Example.org"] });
  check("imports every session", res.sessions === 60, res.sessions);
  check("refuses to double-import", await importProgramme({ query: (q, p) => rows(q, p) as never }, seed).then(() => false, () => true));
  const tz = await rows(`select to_char(start_time at time zone 'Asia/Dubai', 'HH24:MI') as t from sessions where title = 'Welcome & Opening Remarks'`);
  check("times stored in UTC, 08:45 Dubai", tz[0]?.t === "08:45", tz);
  const pres = await rows(`select p.full_name, a.role, a.presents from assignments a join people p on p.id = a.person_id where not p.is_placeholder and a.presents and a.role in ('panelist','moderator') order by 1`);
  check("only the researcher panel's panelists present", pres.length === 2 && pres.every((r) => ["Hana Abusharib", "Rawad Hodeify"].includes(r.full_name as string)), pres);
  const mods = await rows(`select count(*)::int as n from assignments a join people p on p.id = a.person_id where a.role = 'moderator' and not p.is_placeholder`);
  check("named moderators imported (8 from the programme + 1 test fixture)", mods[0].n === 9, mods);
  const mazin = await rows(`select count(*)::int as n from assignments a join people p on p.id = a.person_id where p.full_name = 'Mazin Gadir'`);
  check("multi-role person has every engagement", mazin[0].n === 2, mazin);
  const order = await rows(`select s.title from sessions s join tracks t on t.id = s.track_id where t.name = 'Health Information Exchange Summit' order by sequence`);
  check("breaks sit in the running order", order[7]?.title === "Lunch Break", order[7]);
  const prod = await rows(`select p.app_role from people p join people_private pp on pp.person_id = p.id where pp.email = 'producer@example.org'`);
  check("producer row created", prod[0]?.app_role === "producer", prod);
  const draft = await rows(`select status from sessions where title like 'Women%'`);
  check("TBC track imported as draft", draft[0]?.status === "draft", draft);
  check("TBC placeholders cannot be claimed", (await count(`select * from people where is_placeholder and auth_user_id is not null`)) === 0);
  console.log(`  ${res.flags.length} flags for the producer`);

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
