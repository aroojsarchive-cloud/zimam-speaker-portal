// Updates the live programme from a revised programme file IN PLACE.
// Unlike import-programme (which builds from scratch), this keeps everything
// speakers have done: emails, logins, photos, confirmations, checklist progress,
// slides-sent, briefs and check-ins. It only changes what's different, and
// reports every change in plain language. Dry run unless `apply` is true.
import { fromZonedTime } from "date-fns-tz";
import { Programme } from "./import-programme";
import type { Db } from "./import-programme";

const SAL = /^(h\.?e\.?|dr\.?|prof\.?|mr\.?|ms\.?|mrs\.?|eng\.?)\s+/i;
/** Comparable form of a person's name: no salutation, no al/el, letters only. */
export const normName = (s: string) =>
  s
    .replace(SAL, "")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\b(al|el)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
const normTitle = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
const STOP = new Set(["the", "and", "for", "with", "from", "into", "our", "how", "what", "where", "who", "age", "its", "are", "can"]);
const words = (s: string) => new Set(normTitle(s).split(" ").filter((w) => w.length > 2 && !STOP.has(w)));
/** Share of meaningful words two titles have in common (0–1, intersection over union). */
function similarity(a: string, b: string) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const w of A) if (B.has(w)) n++;
  return n / (A.size + B.size - n);
}

function editDistance(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export interface SyncReport {
  changes: string[];
  warnings: string[];
  counts: { sessionsChanged: number; sessionsAdded: number; sessionsHidden: number; peopleAdded: number; assignmentsAdded: number; assignmentsRemoved: number; rolesChanged: number };
}

// Times come back as Date objects from the database drivers; always compare via new Date(...).
type DbSession = { id: string; title: string; label: string | null; block_label: string | null; format: string; session_type: string; status: string; description: string | null; start_time: string | Date; end_time: string | Date; sequence: number };
type DbAssign = { id: string; person_id: string; role: string; status: string; presents: boolean; full_name: string; is_placeholder: boolean };

export async function syncProgramme(
  db: Db,
  raw: unknown,
  opts: { apply?: boolean; aliases?: Record<string, string> } = {},
): Promise<SyncReport> {
  const p = Programme.parse(raw);
  const tz = p.event.timezone;
  const at = (date: string, time: string) => fromZonedTime(`${date}T${time}:00`, tz).toISOString();
  const hhmm = (iso: string | Date) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  const apply = !!opts.apply;
  const run = async (q: string, params: unknown[] = []) => (apply ? db.query(q, params) : []);
  const changes: string[] = [];
  const warnings: string[] = [];
  const counts = { sessionsChanged: 0, sessionsAdded: 0, sessionsHidden: 0, peopleAdded: 0, assignmentsAdded: 0, assignmentsRemoved: 0, rolesChanged: 0 };

  const [ev] = await db.query<{ id: string }>(`select id from events where slug = $1`, [p.event.slug]);
  if (!ev) throw new Error(`No event "${p.event.slug}" to update.`);

  // ── People: match file people to existing ones by name (with aliases), add the rest ──
  const existing = await db.query<{ id: string; full_name: string }>(
    `select id, full_name from people where event_id = $1 and not is_placeholder`,
    [ev.id],
  );
  const byName = new Map(existing.map((x) => [normName(x.full_name), x.id]));
  const aliases = Object.fromEntries(Object.entries(opts.aliases ?? {}).map(([k, v]) => [normName(k), normName(v)]));
  const personId = new Map<string, string>();
  for (const fp of p.people) {
    const n = normName(fp.full_name);
    let id = byName.get(aliases[n] ?? n);
    if (!id) {
      // Spelling variants ("Nour El Arnout" / "Nour El Arnaout", "Hamid Al Mahdali" / "Hamed AlMahdali"):
      // compare without spaces or al/el, same first letter, small edit distance.
      const compact = (x: string) => normName(x).replace(/ /g, "").replace(/(^|)(al|el)/g, "");
      const c = compact(fp.full_name);
      const scored = existing
        .map((x) => ({ x, d: editDistance(c, compact(x.full_name)) }))
        .filter(({ x, d }) => normName(x.full_name)[0] === n[0] && d <= Math.max(2, Math.floor(c.length * 0.25)))
        .sort((a, b) => a.d - b.d);
      if (scored.length && (scored.length === 1 || scored[0].d < scored[1].d)) {
        id = scored[0].x.id;
        warnings.push(`Treated "${fp.full_name}" as the same person as "${scored[0].x.full_name}" (spelling differs). Check.`);
      }
    }
    if (!id) {
      changes.push(`➕ New person: ${[fp.salutation, fp.full_name].filter(Boolean).join(" ")}${fp.organisation ? `, ${fp.organisation}` : ""}`);
      counts.peopleAdded++;
      if (apply) {
        const [row] = await db.query<{ id: string }>(
          `insert into people (event_id, salutation, full_name, title, organisation, country) values ($1,$2,$3,$4,$5,$6) returning id`,
          [ev.id, fp.salutation ?? null, fp.full_name, fp.title ?? null, fp.organisation ?? null, fp.country ?? null],
        );
        await db.query(`insert into people_private (person_id, email) values ($1,$2)`, [row.id, fp.email?.toLowerCase() ?? null]);
        id = row.id;
      } else id = `new:${fp.key}`;
      byName.set(n, id);
    }
    personId.set(fp.key, id);
  }

  // ── Days, tracks, sessions ──
  for (const day of p.days) {
    let [d] = await db.query<{ id: string }>(`select id from days where event_id = $1 and date = $2`, [ev.id, day.date]);
    if (!d) {
      changes.push(`➕ New day: ${day.date} ${day.label}`);
      if (apply) [d] = await db.query<{ id: string }>(`insert into days (event_id, date, label) values ($1,$2,$3) returning id`, [ev.id, day.date, day.label]);
      else d = { id: `new-day:${day.date}` };
    }
    const tracks = d.id.startsWith("new")
      ? []
      : await db.query<{ id: string; name: string; short_name: string | null; room: string | null }>(
          `select id, name, short_name, room from tracks where day_id = $1`,
          [d.id],
        );

    for (const [ti, ft] of day.tracks.entries()) {
      const t =
        tracks.find((x) => normTitle(x.name) === normTitle(ft.name)) ??
        tracks.find((x) => ft.short_name && x.short_name && normTitle(x.short_name) === normTitle(ft.short_name)) ??
        tracks.find((x) => similarity(x.name, ft.name) >= 0.7);
      let trackId = t?.id;
      if (!t) {
        changes.push(`➕ New programme on ${day.date}: ${ft.name} (${ft.room ?? "room TBC"})`);
        if (apply)
          [{ id: trackId }] = await db.query<{ id: string }>(
            `insert into tracks (day_id, name, short_name, strapline, room, colour, sort_order) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
            [d.id, ft.name, ft.short_name ?? null, ft.strapline ?? null, ft.room ?? null, ft.colour ?? null, ti],
          );
      } else {
        if ((ft.room ?? null) !== t.room && ft.room !== undefined) {
          changes.push(`🚪 ${ft.name}: room ${t.room ?? "TBC"} → ${ft.room ?? "TBC"}`);
          await run(`update tracks set room = $2 where id = $1`, [t.id, ft.room ?? null]);
        }
        if (normTitle(t.name) !== normTitle(ft.name)) {
          changes.push(`✏️ Programme renamed: "${t.name}" → "${ft.name}"`);
          await run(`update tracks set name = $2 where id = $1`, [t.id, ft.name]);
        }
      }

      const dbSessions = trackId && !trackId.startsWith("new")
        ? await db.query<DbSession>(
            `select id, title, label, block_label, format, session_type, status, description, start_time, end_time, sequence from sessions where track_id = $1 order by start_time`,
            [trackId],
          )
        : [];
      const used = new Set<string>();
      let block: string | undefined;

      for (const [si, fs] of ft.sessions.entries()) {
        block = fs.block ?? block;
        const start = at(day.date, fs.start);
        const end = at(day.date, fs.end);
        const free = dbSessions.filter((x) => !used.has(x.id));
        // Same title first; then a close title; then same slot and format (a retitled session).
        // 1. same title · 2. same slot and format (retitled) · 3. clearly similar title (moved).
        const sameSlot = (x: DbSession) => new Date(x.start_time).getTime() === new Date(start).getTime();
        const match =
          free.find((x) => normTitle(x.title) === normTitle(fs.title)) ??
          free.find((x) => sameSlot(x) && x.format === fs.format) ??
          // A title that was only extended or shortened ("The Landscape of…" → "The Landscape of… Development: …").
          free.find((x) => {
            const [o, n] = [normTitle(x.title), normTitle(fs.title)];
            return Math.min(o.length, n.length) >= 20 && (n.startsWith(o) || o.startsWith(n));
          }) ??
          free
            .map((x) => ({ x, s: similarity(x.title, fs.title) }))
            .filter((m) => m.s >= 0.5)
            .sort((a, b) => b.s - a.s)[0]?.x;
        const label = `${hhmm(start)} ${fs.title}`;
        let sessionId: string;
        if (!match) {
          changes.push(`➕ New session · ${ft.name} · ${fs.start}–${fs.end} · ${fs.title}`);
          counts.sessionsAdded++;
          if (apply && trackId) {
            const [row] = await db.query<{ id: string }>(
              `insert into sessions (track_id, start_time, end_time, sequence, block_label, label, title, format, session_type, description, status, published_at)
               values ($1,$2,$3,$4,$5,$6,$7,$8::session_format,$9::session_type,$10,$11::publish_status, case when $11 = 'published' then now() end) returning id`,
              [trackId, start, end, si + 1, block ?? null, fs.label ?? null, fs.title, fs.format, fs.type, fs.description ?? null, fs.status],
            );
            sessionId = row.id;
          } else sessionId = `new-session:${si}`;
        } else {
          used.add(match.id);
          sessionId = match.id;
          const diffs: string[] = [];
          const setCols: string[] = [];
          const vals: unknown[] = [match.id];
          const set = (col: string, v: unknown) => {
            vals.push(v);
            setCols.push(`${col} = $${vals.length}${col === "format" ? "::session_format" : col === "session_type" ? "::session_type" : ""}`);
          };
          if (new Date(match.start_time).getTime() !== new Date(start).getTime() || new Date(match.end_time).getTime() !== new Date(end).getTime()) {
            diffs.push(`time ${hhmm(match.start_time)}–${hhmm(match.end_time)} → ${fs.start}–${fs.end}`);
            set("start_time", start);
            set("end_time", end);
          }
          if (match.title !== fs.title) {
            diffs.push(`title "${match.title}" → "${fs.title}"`);
            set("title", fs.title);
          }
          if ((match.label ?? null) !== (fs.label ?? null)) set("label", fs.label ?? null);
          if (match.format !== fs.format) {
            diffs.push(`format ${match.format} → ${fs.format}`);
            set("format", fs.format);
          }
          if (match.session_type !== fs.type) set("session_type", fs.type);
          if (fs.description !== undefined && (match.description ?? "") !== fs.description) set("description", fs.description);
          if ((match.block_label ?? null) !== (block ?? null)) set("block_label", block ?? null);
          if (match.sequence !== si + 1) set("sequence", si + 1);
          if (match.status !== fs.status) {
            diffs.push(fs.status === "published" ? "now visible to speakers" : "hidden from speakers");
            set("status", fs.status);
          }
          if (diffs.length) {
            changes.push(`⏰ ${ft.name} · ${label}: ${diffs.join("; ")}`);
            counts.sessionsChanged++;
          }
          if (setCols.length) await run(`update sessions set ${setCols.join(", ")} where id = $1`, vals);
        }

        // ── Who's on this session ──
        const current = sessionId.startsWith("new")
          ? []
          : await db.query<DbAssign>(
              `select a.id, a.person_id, a.role, a.status, a.presents, p.full_name, p.is_placeholder
                 from assignments a join people p on p.id = a.person_id where a.session_id = $1`,
              [sessionId],
            );
        const keep = new Set<string>();
        for (const [pi, sp] of fs.people.entries()) {
          if ("key" in sp) {
            const pid = personId.get(sp.key)!;
            const fp = p.people.find((x) => x.key === sp.key)!;
            // Same person + same role first, so someone with two roles in one session
            // (e.g. keynote and moderator) never has their roles swapped.
            const ex =
              current.find((a) => a.person_id === pid && a.role === sp.role && !keep.has(a.id)) ??
              current.find(
                (a) =>
                  a.person_id === pid &&
                  !keep.has(a.id) &&
                  !fs.people.some((o) => "key" in o && o.key === sp.key && o.role === a.role),
              );
            if (ex) {
              keep.add(ex.id);
              if (ex.role !== sp.role) {
                changes.push(`🎤 ${label}: ${fp.full_name} ${ex.role} → ${sp.role}`);
                counts.rolesChanged++;
                await run(`update assignments set role = $2::assignment_role, sort_order = $3 where id = $1`, [ex.id, sp.role, sp.role === "moderator" ? -1 : pi]);
              }
              if (sp.presents !== undefined && sp.presents !== ex.presents)
                await run(`update assignments set presents = $2 where id = $1`, [ex.id, sp.presents]);
            } else {
              changes.push(`➕ ${label}: add ${fp.full_name} (${sp.role})`);
              counts.assignmentsAdded++;
              const presents = sp.presents ?? (fs.type === "speaking" && ["keynote", "speaker"].includes(sp.role) && ["keynote", "lecture", "workshop"].includes(fs.format));
              if (apply && !pid.startsWith("new") && !sessionId.startsWith("new"))
                await db.query(
                  `insert into assignments (person_id, session_id, role, status, sort_order, presents) values ($1,$2,$3::assignment_role,$4::assignment_status,$5,$6)`,
                  [pid, sessionId, sp.role, sp.status, sp.role === "moderator" ? -1 : pi, presents],
                );
            }
          } else {
            // TBC slot: keep an existing placeholder with the same wording, otherwise add one.
            const ex = current.find((a) => a.is_placeholder && normTitle(a.full_name) === normTitle(sp.tbc) && !keep.has(a.id));
            if (ex) {
              keep.add(ex.id);
              continue;
            }
            changes.push(`➕ ${label}: add TBC slot "${sp.tbc}" (${sp.role})`);
            if (apply && !sessionId.startsWith("new")) {
              const [ph] = await db.query<{ id: string }>(`insert into people (event_id, full_name, is_placeholder) values ($1,$2,true) returning id`, [ev.id, sp.tbc]);
              await db.query(`insert into people_private (person_id) values ($1)`, [ph.id]);
              await db.query(
                `insert into assignments (person_id, session_id, role, status, sort_order, presents) values ($1,$2,$3::assignment_role,'tbc',$4,$5)`,
                [ph.id, sessionId, sp.role, sp.role === "moderator" ? -1 : pi, sp.presents ?? false],
              );
            }
          }
        }
        for (const a of current.filter((a) => !keep.has(a.id))) {
          if (a.is_placeholder) {
            await run(`delete from people where id = $1`, [a.person_id]); // slot filled or dropped
          } else {
            changes.push(`➖ ${label}: remove ${a.full_name} (${a.role})`);
            counts.assignmentsRemoved++;
            await run(`delete from assignments where id = $1`, [a.id]);
          }
        }
        // Speakers see "Your sessions were updated".
        if (!sessionId.startsWith("new")) await run(`update sessions set updated_at = now() where id = $1`, [sessionId]);
      }

      // Sessions in this programme that the new file no longer has: hide, don't delete.
      for (const x of dbSessions.filter((x) => !used.has(x.id) && x.status === "published")) {
        changes.push(`🙈 ${ft.name} · ${hhmm(x.start_time)} ${x.title}: not in the new programme. Hidden (not deleted)`);
        counts.sessionsHidden++;
        // Out of the running order too (kept at the end, hidden).
        await run(`update sessions set status = 'draft', sequence = 900 + sequence where id = $1`, [x.id]);
      }
    }
  }
  return { changes, warnings, counts };
}
