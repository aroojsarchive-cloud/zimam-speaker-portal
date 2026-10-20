// End-to-end bug test against a running portal (live by default). Self-cleaning.
// Usage: npm run smoke            (tests LIVE_SITE_URL)
//        npm run smoke -- --local (tests http://localhost:3010)
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

const BASE = (process.argv.includes("--local") ? "http://localhost:3010" : process.env.LIVE_SITE_URL!).replace(/\/$/, "");
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const admin = createClient(URL_, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const sql = postgres(process.env.DATABASE_URL!, { prepare: false, max: 1, onnotice: () => {} });

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) pass++;
  else {
    failures.push(name);
    console.log(`  ✗ ${name}`, detail === undefined ? "" : JSON.stringify(detail).slice(0, 300));
  }
}
const section = (s: string) => console.log(`\n${s}`);
const cleanups: (() => Promise<unknown>)[] = [];

/** Signs in and returns both a cookie header (for page requests) and a Supabase client (for API calls). */
async function signIn(email: string, password?: string) {
  const jar = new Map<string, string>();
  const client = createServerClient(URL_, ANON, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  if (password) {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`sign-in ${email}: ${error.message}`);
  } else {
    await admin.auth.admin.createUser({ email, email_confirm: true }).catch(() => undefined);
    const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (error) throw error;
    const v = await client.auth.verifyOtp({ type: "email", token_hash: data.properties!.hashed_token });
    if (v.error) throw new Error(`verify ${email}: ${v.error.message}`);
  }
  await client.rpc("claim_person");
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  return { client: client as unknown as SupabaseClient, cookie };
}

/** GETs a page and checks it rendered without a server error (including errors inside streamed sections). */
async function page(path: string, cookie: string | null, expect: { status?: number; redirectTo?: string; contains?: string[] } = {}) {
  const res = await fetch(BASE + path, { headers: cookie ? { cookie } : {}, redirect: "manual" });
  const label = `${path}${cookie ? "" : " (signed out)"}`;
  if (expect.redirectTo) {
    const loc = res.headers.get("location") ?? "";
    const body = [301, 302, 303, 307, 308].includes(res.status) ? "" : await res.text();
    // Either a real HTTP redirect (proxy) or a streamed redirect the browser follows.
    const streamed = new RegExp(`NEXT_REDIRECT;[a-z]+;${expect.redirectTo.replace(/[?]/g, "\\?")};`).test(body);
    check(`${label} redirects to ${expect.redirectTo}`, loc.includes(expect.redirectTo) || streamed, { status: res.status, loc });
    return "";
  }
  if (expect.status === 404) {
    const body = (await res.text()).replace(/<!-- -->/g, "").replace(/&#x27;|&apos;/g, "'");
    check(`${label} shows "not found"`, res.status === 404 || /NEXT_HTTP_ERROR_FALLBACK;404/.test(body), res.status);
    return "";
  }
  const html = await res.text();
  check(`${label} → ${expect.status ?? 200}`, res.status === (expect.status ?? 200), res.status);
  // Production hides error messages but leaves a digest on the boundary that failed.
  const digests = [...html.matchAll(/data-dgst="([^"]+)"/g)].map((m) => m[1]).filter((d) => !d.startsWith("NEXT_"));
  check(`${label} has no server errors`, digests.length === 0, digests);
  const text = html.replace(/<!-- -->/g, "").replace(/&#x27;|&apos;/g, "'");
  for (const c of expect.contains ?? []) check(`${label} shows "${c}"`, text.includes(c), null);
  return html;
}

async function main() {
  console.log(`Testing ${BASE}`);
  const [ev] = await sql`select id from events where slug = 'zimam-2026'`;

  // ───────────── 1. Signed-out access ─────────────
  section("Signed out");
  await page("/login", null, { contains: ["Your email", "Continue"] });
  await page("/", null, { redirectTo: "/login" });
  await page("/agenda", null, { redirectTo: "/login" });
  await page("/admin", null, { redirectTo: "/login" });
  await page("/guidelines", null, { redirectTo: "/login" });
  await page("/i/notarealtoken", null, { redirectTo: "/login?reason=bad-link" });
  await page(`/i/${"0".repeat(32)}`, null, { redirectTo: "/login?reason=bad-link" });
  const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
  for (const t of ["sessions", "people", "people_private", "assignments", "concept_notes", "slide_submissions", "login_attempts"]) {
    const { data, error } = await anon.from(t).select("*").limit(1);
    check(`anonymous API sees nothing in ${t}`, !error && (data ?? []).length === 0, error?.message ?? data);
  }

  // ───────────── 2. Programme data integrity (live event) ─────────────
  section("Programme data");
  const overlaps = await sql`
    select t.name, a.title as a, b.title as b from sessions a join sessions b on a.track_id = b.track_id and a.id < b.id
      join tracks t on t.id = a.track_id
     where a.start_time < b.end_time and b.start_time < a.end_time and a.event_id = ${ev.id}`;
  check("no overlapping sessions in the same room", overlaps.length === 0, overlaps);
  const bad = await sql`select title from sessions where end_time <= start_time and event_id = ${ev.id}`;
  check("every session ends after it starts", bad.length === 0, bad);
  const noRoom = await sql`select t.name from tracks t where t.room is null and t.event_id = ${ev.id} and exists (select 1 from sessions s where s.track_id = t.id and s.status = 'published' and s.session_type = 'speaking')`;
  check("every published programme with speakers has a room", noRoom.length === 0, noRoom.map((r) => r.name));
  const seq = await sql`select track_id, sequence, count(*) from sessions where event_id = ${ev.id} group by 1, 2 having count(*) > 1`;
  check("running order positions are unique per room", seq.length === 0, seq);
  const presBad = await sql`select p.full_name from assignments a join sessions s on s.id = a.session_id join people p on p.id = a.person_id where a.presents and s.session_type <> 'speaking' and a.event_id = ${ev.id}`;
  check("nobody is asked for slides in a non-speaking slot", presBad.length === 0, presBad);
  const modPres = await sql`select p.full_name from assignments a join people p on p.id = a.person_id where a.presents and a.role = 'moderator' and a.event_id = ${ev.id}`;
  check("no moderator is asked for slides", modPres.length === 0, modPres);
  const phEmail = await sql`select p.full_name from people p join people_private pp on pp.person_id = p.id where p.is_placeholder and pp.email is not null and p.event_id = ${ev.id}`;
  check("TBC placeholders have no email (cannot sign in)", phEmail.length === 0, phEmail);
  const dupEmail = await sql`select email from people_private where email is not null and event_id = ${ev.id} group by email having count(*) > 1`;
  check("no email is used twice", dupEmail.length === 0, dupEmail);
  const tok = await sql`select count(*)::int n from people_private pp join people p on p.id = pp.person_id where not p.is_placeholder and pp.invite_token is null and p.event_id = ${ev.id}`;
  check("every real person has a personal invite link", tok[0].n === 0, tok[0]);
  const [prod] = await sql`select count(*)::int n from people where app_role = 'producer' and event_id = ${ev.id}`;
  check("a producer exists", prod.n >= 1, prod);
  const contact = await sql`select producer_whatsapp from events where id = ${ev.id}`;
  check("producer WhatsApp is set", !!contact[0].producer_whatsapp, contact[0]);
  const orphanBrief = await sql`select s.title from concept_notes n join sessions s on s.id = n.session_id where n.summary like '%(Test brief.)%'`;
  check("no leftover test briefs", orphanBrief.length === 0, orphanBrief);

  // ───────────── 3. Speaker pages (example speaker Juliet) ─────────────
  section("Speaker pages");
  const julietEmail = "juliet.ibrahim@example.org";
  const [juliet] = await sql`select person_id from people_private where email = ${julietEmail}`;
  if (!juliet) check("example speaker exists (run npm run demo)", false);
  else {
    const j = await signIn(julietEmail);
    const c = j.cookie();
    await page("/", c, { contains: ["Hi Juliet", "Get ready", "Read the speaker guidelines", "Questions?"] });
    await page("/guidelines", c, { contains: ["Keeping to time", "5 minutes left", "USB", "arooj@mwanevents.com"] });
    const agenda = await page("/agenda", c, { contains: ["Programme at a glance", "At a glance"] });
    const tabs = [...new Set([...agenda.matchAll(/href="\/agenda\?tab=([^"&]+)"/g)].map((m) => m[1]))];
    check("agenda has At a glance + 5 programme tabs", tabs.length === 6, tabs);
    for (const t of tabs) await page(`/agenda?tab=${t}`, c);
    const sessions = await sql`select id, session_type from sessions where event_id = ${ev.id} and status = 'published'`;
    for (const s of sessions) await page(`/sessions/${s.id}`, c, { contains: ["Where this sits"] });
    const draft = await sql`select id from sessions where event_id = ${ev.id} and status = 'draft' limit 1`;
    if (draft[0]) await page(`/sessions/${draft[0].id}`, c, { status: 404 });
    await page("/sessions/not-a-session", c, { status: 404 });
    const [mine] = await sql`select session_id from assignments where person_id = ${juliet.person_id} limit 1`;
    const ics = await fetch(`${BASE}/sessions/${mine.session_id}/calendar.ics`, { headers: { cookie: c } });
    const icsText = await ics.text();
    check("calendar download works", ics.status === 200 && icsText.includes("BEGIN:VEVENT") && icsText.includes("TRIGGER:-PT30M"), ics.status);
    await page("/admin", c, { redirectTo: "/" });
    await page("/admin/people", c, { redirectTo: "/" });
    const { data: priv } = await j.client.from("people_private").select("email");
    check("speaker sees only their own email", (priv ?? []).length === 1, (priv ?? []).length);
    const { data: logs } = await j.client.from("change_log").select("id").limit(1);
    check("speaker cannot read the change log", (logs ?? []).length === 0);
    await j.client.auth.signOut();
  }

  // ───────────── 4. Producer pages (temporary producer in the live event) ─────────────
  section("Producer pages");
  const pEmail = `smoke-producer-${Date.now()}@example.org`;
  const pPass = randomUUID();
  const [pp] = await sql`insert into people (event_id, full_name, app_role, details_status) values (${ev.id}, 'Smoke Test Producer', 'producer', 'confirmed') returning id`;
  await sql`insert into people_private (person_id, email) values (${pp.id}, ${pEmail})`;
  const { data: pu } = await admin.auth.admin.createUser({ email: pEmail, password: pPass, email_confirm: true });
  cleanups.push(() => sql`delete from people where id = ${pp.id}`, () => admin.auth.admin.deleteUser(pu.user!.id));
  const p = await signIn(pEmail, pPass);
  const pc = p.cookie();
  await page("/", pc, { redirectTo: "/admin" });
  await page("/admin", pc, { contains: ["Speaker progress", "Opened their link"] });
  await page("/admin?view=least", pc);
  await page("/admin?view=stuck", pc);
  await page("/admin?view=moderators", pc);
  await page("/admin/people", pc, { contains: ["Copy invite", "Presenting slides"] });
  await page("/admin/people?filter=no-email", pc);
  await page("/admin/people?q=ibrahim", pc);
  await page("/admin/slides", pc, { contains: ["arooj@mwanevents.com", "say they"] });
  await page("/admin/programme", pc, { contains: ["Programme", "Edit programme details", "+ Add session at the end"] });
  for (const d of ["2026-11-04", "2026-11-05", "2026-11-06"]) await page(`/admin/programme?day=${d}`, pc);
  await page("/admin/print", pc, { contains: ["Print / Save as PDF", "Day 1", "Printed from live data"] });
  const rooms = await page("/admin/print?view=rooms", pc, { contains: ["Running order", "On stage"] });
  if (process.env.SAVE_PRINT_HTML) {
    const { writeFileSync } = await import("node:fs");
    const agenda = await (await fetch(`${BASE}/admin/print`, { headers: { cookie: pc } })).text();
    const base = `<base href="${BASE}/">`;
    writeFileSync(`${process.env.SAVE_PRINT_HTML}/agenda.html`, agenda.replace("<head>", `<head>${base}`));
    writeFileSync(`${process.env.SAVE_PRINT_HTML}/rooms.html`, rooms.replace("<head>", `<head>${base}`));
  }
  await page("/admin/live", pc);
  await page("/admin/live?at=2026-11-04T14:40", pc, { contains: ["Rehearsal time", "Now"] });
  await page("/agenda", pc);
  const { data: allPriv } = await p.client.from("people_private").select("email");
  check("producer sees everyone's contact details", (allPriv ?? []).length > 10, (allPriv ?? []).length);

  // ───────────── 5. Speaker & moderator actions (isolated throwaway event) ─────────────
  section("Speaker & moderator actions (throwaway event)");
  const tag = Date.now();
  const [tev] = await sql`insert into events (name, slug, start_date, end_date, venue) values ('Smoke test', ${`smoke-${tag}`}, '2026-11-04', '2026-11-04', 'Test') returning id`;
  cleanups.unshift(() => sql`delete from events where id = ${tev.id}`);
  const [day] = await sql`insert into days (event_id, date, label) values (${tev.id}, '2026-11-04', 'Test day') returning id`;
  const [trk] = await sql`insert into tracks (day_id, name, room) values (${day.id}, 'Test track', 'Room T') returning id`;
  const [ses] = await sql`insert into sessions (track_id, start_time, end_time, sequence, title, format, status) values (${trk.id}, '2026-11-04 10:00+04', '2026-11-04 10:40+04', 1, 'Test panel', 'panel', 'published') returning id`;
  const [drf] = await sql`insert into sessions (track_id, start_time, end_time, sequence, title, format, status) values (${trk.id}, '2026-11-04 11:00+04', '2026-11-04 11:30+04', 2, 'Secret draft', 'panel', 'draft') returning id`;
  const mk = async (name: string, role: string) => {
    const email = `smoke-${name.toLowerCase()}-${tag}@example.org`;
    const [r] = await sql`insert into people (event_id, full_name) values (${tev.id}, ${name}) returning id`;
    await sql`insert into people_private (person_id, email, phone) values (${r.id}, ${email}, '+0000')`;
    const [a] = await sql`insert into assignments (person_id, session_id, role, presents) values (${r.id}, ${ses.id}, ${role}, ${role === "speaker"}) returning id`;
    return { id: r.id as string, email, assignment: a.id as string };
  };
  const spk = await mk("Speaker", "speaker");
  const mod = await mk("Moderator", "moderator");
  const pan = await mk("Panelist", "panelist");
  const emails = [spk.email, mod.email, pan.email];
  cleanups.push(async () => {
    for (const u of (await admin.auth.admin.listUsers({ perPage: 1000 })).data.users)
      if (emails.includes(u.email ?? "")) await admin.auth.admin.deleteUser(u.id);
  });
  cleanups.push(async () => {
    for (const b of ["slides", "photos", "briefs"]) {
      for (const prefix of [ses.id, spk.id]) {
        const { data } = await admin.storage.from(b).list(prefix, { limit: 100 });
        for (const f of data ?? []) {
          if (f.id) await admin.storage.from(b).remove([`${prefix}/${f.name}`]);
          else {
            const { data: inner } = await admin.storage.from(b).list(`${prefix}/${f.name}`, { limit: 100 });
            await admin.storage.from(b).remove((inner ?? []).map((x) => `${prefix}/${f.name}/${x.name}`));
          }
        }
      }
    }
  });

  const S = (await signIn(spk.email)).client;
  const M = (await signIn(mod.email)).client;
  const X = (await signIn(pan.email)).client;

  const { data: seen } = await S.from("sessions").select("title").eq("event_id", tev.id);
  check("speaker sees published sessions, not drafts", seen?.length === 1 && seen[0].title === "Test panel", seen);
  const { data: draftAssign } = await S.from("assignments").select("id").eq("session_id", drf.id);
  check("speaker cannot see a draft session's people", (draftAssign ?? []).length === 0);
  const { data: others } = await S.from("people_private").select("email").eq("event_id", tev.id);
  check("speaker cannot see other people's email or phone", others?.length === 1 && others[0].email === spk.email, others);

  check("confirm details works", !(await S.rpc("confirm_details", { p_person: spk.id })).error);
  check("cannot confirm someone else's details", !!(await S.rpc("confirm_details", { p_person: pan.id })).error);
  check("flag a change works", !(await S.rpc("request_details_change", { p_person: spk.id, p_note: "Title should be X" })).error);
  check("empty change note is refused", !!(await S.rpc("request_details_change", { p_person: spk.id, p_note: "  " })).error);
  check("acknowledge guidelines works", !(await S.rpc("acknowledge_guidelines", { p_person: spk.id })).error);
  check("'I've emailed my slides' works", !(await S.rpc("mark_slides_sent", { p_assignment: spk.assignment, p_sent: true })).error);
  check("cannot mark someone else's slides as sent", !!(await S.rpc("mark_slides_sent", { p_assignment: pan.assignment, p_sent: true })).error);
  check("mark session checked works", !(await S.rpc("mark_session_reviewed", { p_assignment: spk.assignment })).error);
  check("cannot mark someone else's session", !!(await S.rpc("mark_session_reviewed", { p_assignment: pan.assignment })).error);
  check("'not using slides' works", !(await S.rpc("set_no_slides", { p_assignment: spk.assignment, p_value: true })).error);
  check("check-in is refused before the event day", !!(await S.rpc("check_in", { p_assignment: spk.assignment })).error);
  // On the day: a session today in the throwaway event.
  const [todaySes] = await sql`insert into sessions (track_id, start_time, end_time, sequence, title, format, status)
    values (${trk.id}, now() + interval '10 minutes', now() + interval '40 minutes', 9, 'Today', 'lecture', 'published') returning id`;
  const [todayA] = await sql`insert into assignments (person_id, session_id, role) values (${spk.id}, ${todaySes.id}, 'speaker') returning id`;
  const [panToday] = await sql`insert into assignments (person_id, session_id, role) values (${pan.id}, ${todaySes.id}, 'panelist') returning id`;
  const first = await S.rpc("check_in", { p_assignment: todayA.id });
  check("on the day, 'I'm in the room' works", !first.error && !!first.data, first.error);
  const again = await S.rpc("check_in", { p_assignment: todayA.id });
  check("checking in twice keeps the first time", again.data === first.data, { first: first.data, again: again.data });
  check("cannot check someone else in", !!(await S.rpc("check_in", { p_assignment: panToday.id })).error);
  await sql`delete from sessions where id = ${todaySes.id}`;
  const { data: edited } = await S.from("people").update({ full_name: "Hacked" }).eq("id", spk.id).select("id");
  check("speaker cannot edit their name directly", (edited ?? []).length === 0);
  const { data: sesEdit } = await S.from("sessions").update({ title: "x" }).eq("id", ses.id).select("id");
  check("speaker cannot edit a session", (sesEdit ?? []).length === 0);
  const { data: asgEdit } = await S.from("assignments").update({ presents: false }).eq("id", spk.assignment).select("id");
  check("speaker cannot change who presents", (asgEdit ?? []).length === 0);

  const pdf = new Blob(["%PDF-1.1\n%%EOF"], { type: "application/pdf" });
  const slidePath = `${ses.id}/${spk.id}/smoke.pdf`;
  check("speaker can upload slides", !(await S.storage.from("slides").upload(slidePath, pdf)).error);
  check("slide submission is recorded", !(await S.from("slide_submissions").insert({ session_id: ses.id, person_id: spk.id, file_path: slidePath, file_name: "smoke.pdf", size_bytes: 14 })).error);
  check("cannot upload into someone else's slide folder", !!(await S.storage.from("slides").upload(`${ses.id}/${pan.id}/x.pdf`, pdf)).error);
  check("cannot submit slides to a session you're not on", !!(await S.from("slide_submissions").insert({ session_id: drf.id, person_id: spk.id, file_path: "x", file_name: "x" })).error);
  const { data: modSlides } = await M.from("slide_submissions").select("id").eq("session_id", ses.id);
  check("moderator sees their panel's slides", (modSlides ?? []).length === 1);
  const { data: panSlides } = await X.from("slide_submissions").select("id").eq("session_id", ses.id);
  check("other panelists cannot see someone's slides", (panSlides ?? []).length === 0);
  const signed = await S.storage.from("slides").createSignedUrl(slidePath, 60);
  check("uploaded slides can be downloaded", !!signed.data?.signedUrl && (await fetch(signed.data.signedUrl)).status === 200);

  const png = new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: "image/png" });
  const photoPath = `${spk.id}/smoke.png`;
  check("speaker can upload their photo", !(await S.storage.from("photos").upload(photoPath, png)).error);
  check("photo is saved to their profile", !(await S.rpc("set_my_photo", { p_person: spk.id, p_path: photoPath })).error);
  check("cannot upload someone else's photo", !!(await S.storage.from("photos").upload(`${pan.id}/x.png`, png)).error);

  check("speaker cannot write a brief", !!(await S.from("concept_notes").insert({ session_id: ses.id, kind: "draft", summary: "x" })).error);
  check("moderator can save a draft brief", !(await M.from("concept_notes").insert({ session_id: ses.id, kind: "draft", summary: "Smoke brief", questions_text: "1. A question for everyone\n2. Speaker, what do you think?" })).error);
  const { data: early } = await S.from("concept_notes").select("id").eq("session_id", ses.id);
  check("speaker cannot see the draft before it's published", (early ?? []).length === 0);
  check("speaker cannot publish", !!(await S.rpc("publish_brief", { p_session: ses.id })).error);
  const pub = await M.rpc("publish_brief", { p_session: ses.id });
  check("moderator can publish (version 1)", pub.data === 1, pub);
  const { data: late } = await S.from("concept_notes").select("summary, questions_text").eq("session_id", ses.id);
  check("speaker sees the published brief with the pasted questions", late?.length === 1 && late[0].summary === "Smoke brief" && (late[0].questions_text ?? "").includes("what do you think"), late);
  check("republishing bumps the version", (await M.rpc("publish_brief", { p_session: ses.id })).data === 2);
  check("moderator cannot publish a session they don't moderate", !!(await M.rpc("publish_brief", { p_session: drf.id })).error);

  // Producer editing (the Programme page's actions) in the throwaway event.
  const prodEmail = `smoke-prod-${tag}@example.org`;
  const prodPass = randomUUID();
  const [tp] = await sql`insert into people (event_id, full_name, app_role) values (${tev.id}, 'Smoke Producer', 'producer') returning id`;
  await sql`insert into people_private (person_id, email) values (${tp.id}, ${prodEmail})`;
  const { data: tpu } = await admin.auth.admin.createUser({ email: prodEmail, password: prodPass, email_confirm: true });
  emails.push(prodEmail);
  void tpu;
  const PR = (await signIn(prodEmail, prodPass)).client;
  const moved = await PR.from("sessions").update({ start_time: "2026-11-04T06:05:00Z", end_time: "2026-11-04T06:45:00Z" }).eq("id", ses.id).select("id");
  check("producer can change a session's time", (moved.data ?? []).length === 1, moved.error);
  const { data: newSes } = await PR.from("sessions").insert({ track_id: trk.id, start_time: "2026-11-04T08:00:00Z", end_time: "2026-11-04T08:15:00Z", sequence: 3, title: "Added by producer", format: "other", status: "draft" }).select("id").single();
  check("producer can add a session", !!newSes?.id);
  const { data: ph } = await PR.from("people").insert({ event_id: tev.id, full_name: "Panelist (TBC)", is_placeholder: true }).select("id").single();
  check("producer can add a TBC slot", !!ph?.id);
  check("producer can put people on a session", !(await PR.from("assignments").insert({ person_id: ph!.id, session_id: newSes!.id, role: "panelist", status: "tbc" })).error);
  const { data: rolech } = await PR.from("assignments").update({ role: "moderator", presents: false }).eq("id", pan.assignment).select("id");
  check("producer can change someone's role", (rolech ?? []).length === 1);
  check("producer can delete a session", !(await PR.from("sessions").delete().eq("id", newSes!.id)).error);
  const { data: trackEdit } = await PR.from("tracks").update({ room: "Room Z" }).eq("id", trk.id).select("id");
  check("producer can change a room", (trackEdit ?? []).length === 1);
  const { data: sEdit2 } = await S.from("tracks").update({ room: "Hacked" }).eq("id", trk.id).select("id");
  check("speaker cannot change a room", (sEdit2 ?? []).length === 0);
  const { data: modEdit } = await M.from("sessions").update({ title: "x" }).eq("id", ses.id).select("id");
  check("moderator cannot edit the session itself", (modEdit ?? []).length === 0);
  const edits = await sql`select field from change_log where event_id = ${tev.id} and entity = 'sessions' and field in ('start_time', 'end_time')`;
  check("time changes are recorded in the change log", edits.length >= 2, edits);

  const [st] = await sql`select details_status, guidelines_ack_at is not null as g from people where id = ${spk.id}`;
  const [as] = await sql`select reviewed_at is not null as r, no_slides from assignments where id = ${spk.assignment}`;
  check("speaker's progress is saved (change request survives the photo upload)", st.details_status === "change_requested" && st.g && as.r && as.no_slides, { st, as });
  const log = await sql`select field from change_log where event_id = ${tev.id} and entity = 'concept_notes'`;
  check("publishing is recorded in the change log", log.length >= 1, log);
}

main()
  .catch((e) => {
    failures.push(`crashed: ${(e as Error).message}`);
    console.error(e);
  })
  .finally(async () => {
    for (const c of cleanups.reverse()) await c().catch((e) => console.log("  cleanup:", (e as Error).message));
    const left = await sql`select count(*)::int n from events where slug like 'smoke-%'`;
    const leftP = await sql`select count(*)::int n from people_private where email like 'smoke-%'`;
    if (left[0].n || leftP[0].n) failures.push(`cleanup left ${left[0].n} events / ${leftP[0].n} people`);
    await sql.end();
    console.log(`\n${pass} passed, ${failures.length} failed${failures.length ? `:\n - ${failures.join("\n - ")}` : ""}`);
    process.exit(failures.length ? 1 : 0);
  });
