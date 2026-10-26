// Imports a programme JSON (see seed/zimam-2026.json) into the database.
// Works against any Postgres connection via a tiny query adapter, so the same
// code runs in tests (PGlite) and for real (Supabase via DATABASE_URL).
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";

const Status = z.enum(["confirmed", "tentative", "invited", "tbc"]);
const Role = z.enum(["moderator", "panelist", "keynote", "speaker", "mc", "jury", "chair", "co_chair", "host"]);
const Time = z.string().regex(/^\d{2}:\d{2}$/);

const SessionPerson = z.union([
  z.object({ key: z.string(), role: Role, status: Status.default("tbc"), presents: z.boolean().optional() }),
  z.object({ tbc: z.string(), role: Role, presents: z.boolean().optional() }),
]);

export const Programme = z.object({
  source: z.string().optional(),
  event: z.object({
    name: z.string(),
    slug: z.string(),
    start_date: z.string(),
    end_date: z.string(),
    venue: z.string(),
    timezone: z.string().default("Asia/Dubai"),
  }),
  people: z.array(
    z.object({
      key: z.string(),
      salutation: z.string().nullish(),
      full_name: z.string(),
      title: z.string().nullish(),
      organisation: z.string().nullish(),
      country: z.string().nullish(),
      email: z.string().email().nullish(),
      phone: z.string().nullish(),
    }),
  ),
  days: z.array(
    z.object({
      date: z.string(),
      label: z.string(),
      tracks: z.array(
        z.object({
          name: z.string(),
          short_name: z.string().nullish(),
          strapline: z.string().nullish(),
          room: z.string().nullish(),
          colour: z.string().nullish(),
          sessions: z.array(
            z.object({
              start: Time,
              end: Time,
              block: z.string().optional(),
              label: z.string().optional(),
              title: z.string(),
              format: z.string(),
              type: z.enum(["speaking", "non_speaking"]).default("speaking"),
              status: z.enum(["draft", "published"]).default("published"),
              description: z.string().optional(),
              people: z.array(SessionPerson).default([]),
            }),
          ),
        }),
      ),
    }),
  ),
  flags: z.array(z.string()).default([]),
});
export type ProgrammeFile = z.input<typeof Programme>;

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
}

export interface ImportResult {
  eventId: string;
  sessions: number;
  people: number;
  placeholders: number;
  assignments: number;
  flags: string[];
}

export async function importProgramme(
  db: Db,
  raw: unknown,
  opts: { replace?: boolean; producerEmails?: string[] } = {},
): Promise<ImportResult> {
  const p = Programme.parse(raw);
  const tz = p.event.timezone;
  const at = (date: string, time: string) => fromZonedTime(`${date}T${time}:00`, tz).toISOString();

  const existing = await db.query<{ id: string }>(`select id from events where slug = $1`, [p.event.slug]);
  if (existing.length) {
    if (!opts.replace) throw new Error(`Event "${p.event.slug}" already exists. Re-run with --replace to wipe and re-import it.`);
    await db.query(`delete from events where id = $1`, [existing[0].id]);
  }

  const [ev] = await db.query<{ id: string }>(
    `insert into events (name, slug, start_date, end_date, venue, timezone) values ($1,$2,$3,$4,$5,$6) returning id`,
    [p.event.name, p.event.slug, p.event.start_date, p.event.end_date, p.event.venue, tz],
  );
  const eventId = ev.id;

  // People with a key are real humans, shared across sessions.
  const personIds = new Map<string, string>();
  for (const person of p.people) {
    const [row] = await db.query<{ id: string }>(
      `insert into people (event_id, salutation, full_name, title, organisation, country)
       values ($1,$2,$3,$4,$5,$6) returning id`,
      [eventId, person.salutation ?? null, person.full_name, person.title ?? null, person.organisation ?? null, person.country ?? null],
    );
    personIds.set(person.key, row.id);
    await db.query(`insert into people_private (person_id, email, phone) values ($1,$2,$3)`, [
      row.id,
      person.email?.toLowerCase() ?? null,
      person.phone ?? null,
    ]);
  }

  for (const email of opts.producerEmails ?? []) {
    const [row] = await db.query<{ id: string }>(
      `insert into people (event_id, full_name, app_role, details_status) values ($1,$2,'producer','confirmed') returning id`,
      [eventId, email.split("@")[0]],
    );
    await db.query(`insert into people_private (person_id, email) values ($1,$2)`, [row.id, email.toLowerCase()]);
  }

  const flags = [...p.flags];
  let sessions = 0;
  let placeholders = 0;
  let assignments = 0;

  for (const day of p.days) {
    const [d] = await db.query<{ id: string }>(
      `insert into days (event_id, date, label) values ($1,$2,$3) returning id`,
      [eventId, day.date, day.label],
    );
    for (const [ti, track] of day.tracks.entries()) {
      const [t] = await db.query<{ id: string }>(
        `insert into tracks (day_id, name, short_name, strapline, room, colour, sort_order) values ($1,$2,$3,$4,$5,$6,$7) returning id`,
        [d.id, track.name, track.short_name ?? null, track.strapline ?? null, track.room ?? null, track.colour ?? null, ti],
      );

      let block: string | undefined;
      let prevEnd: string | undefined;
      for (const [si, s] of track.sessions.entries()) {
        block = s.block ?? block;
        if (prevEnd && s.start !== prevEnd)
          flags.push(`${day.date} ${track.name}: gap or overlap between ${prevEnd} and "${s.title}" at ${s.start}.`);
        prevEnd = s.end;

        const [row] = await db.query<{ id: string }>(
          `insert into sessions (track_id, start_time, end_time, sequence, block_label, label, title, format,
                                 session_type, description, status, published_at)
           values ($1,$2,$3,$4,$5,$6,$7,$8::session_format,$9::session_type,$10,$11::publish_status,
                   case when $11 = 'published' then now() end)
           returning id`,
          [t.id, at(day.date, s.start), at(day.date, s.end), si + 1, block ?? null, s.label ?? null, s.title,
           s.format, s.type, s.description ?? null, s.status],
        );
        sessions++;

        for (const [pi, sp] of s.people.entries()) {
          let personId: string;
          let status: string;
          if ("key" in sp) {
            const id = personIds.get(sp.key);
            if (!id) throw new Error(`Session "${s.title}" refers to unknown person key "${sp.key}"`);
            personId = id;
            status = sp.status;
          } else {
            // Placeholder rows are per-slot so filling one doesn't affect another.
            const [ph] = await db.query<{ id: string }>(
              `insert into people (event_id, full_name, is_placeholder) values ($1,$2,true) returning id`,
              [eventId, sp.tbc],
            );
            await db.query(`insert into people_private (person_id) values ($1)`, [ph.id]);
            personId = ph.id;
            status = "tbc";
            placeholders++;
          }
          await db.query(
            `insert into assignments (person_id, session_id, role, status, sort_order, presents)
             values ($1,$2,$3::assignment_role,$4::assignment_status,$5,$6)`,
            [
              personId,
              row.id,
              sp.role,
              status,
              sp.role === "moderator" ? -1 : pi,
              // Explicit in the file wins; otherwise keynotes and lecture/workshop speakers present.
              sp.presents ?? (s.type === "speaking" && ["keynote", "speaker"].includes(sp.role) && ["keynote", "lecture", "workshop"].includes(s.format)),
            ],
          );
          assignments++;
        }
      }
    }
  }

  for (const message of flags) await db.query(`insert into import_flags (event_id, message) values ($1,$2)`, [eventId, message]);

  return { eventId, sessions, people: p.people.length, placeholders, assignments, flags };
}
