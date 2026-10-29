import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { eventConfig as ev } from "@/config/event";
import { requireProducer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { displayName, roleLabel } from "@/lib/labels";
import { eventDateKey, formatLongDay, formatRange, formatTime } from "@/lib/time";
import { LiveRefresh } from "@/components/LiveRefresh";
import { AutoRefresh } from "@/components/AutoRefresh";
import { LiveTick } from "@/components/LiveTick";
import { RoomDelay } from "@/components/RoomDelay";

export const metadata: Metadata = { title: "Live" };

const WARN_MIN = 20; // speakers are asked to be in the room 20 minutes before
const DOORS_MIN = 15; // "start of day" = this long before the first session

// Dubai has no daylight saving, so a fixed +4h gives the local wall-clock time for ?at=.
const dubaiStamp = (t: number) => new Date(t + 4 * 3600000).toISOString().slice(0, 16);

type Assignment = {
  id: string;
  role: string;
  checked_in_at: string | null;
  person: { salutation: string | null; full_name: string; is_placeholder: boolean };
};
type Session = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  session_type: string;
  /** Planned times, before any running-late shift. */
  planned_start?: string;
  planned_end?: string;
  track: { id: string; name: string; room: string | null; sort_order: number; running_late_minutes: number; running_late_updated_at: string | null };
  assignments: Assignment[];
};

function SessionBlock({ s, kind, now }: { s: Session; kind: "Now" | "Next" | "Then"; now: number }) {
  const people = s.assignments.filter((a) => !a.person.is_placeholder);
  const tbc = s.assignments.length - people.length;
  const startsIn = (new Date(s.start_time).getTime() - now) / 60000;
  const urgent = startsIn <= WARN_MIN;
  return (
    <div className={kind === "Now" ? "" : "mt-4 border-t border-line pt-4"}>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
        {kind} · {formatRange(s.start_time, s.end_time)}
        {kind !== "Now" && startsIn > 0 && ` · in ${Math.round(startsIn)} min`}
      </p>
      {s.planned_start && s.planned_start !== s.start_time && (
        <p className="text-xs text-warning">Planned {formatRange(s.planned_start, s.planned_end!)}</p>
      )}
      <p className="mt-1 font-semibold leading-snug">{s.title}</p>
      {s.session_type === "speaking" && (
        <ul className="mt-2 space-y-1">
          {people.map((a) => {
            const missing = !a.checked_in_at && urgent;
            return (
              <li
                key={a.id}
                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-sm ${
                  a.checked_in_at ? "bg-success/10" : missing ? "bg-danger/10" : "bg-paper"
                }`}
              >
                <span className="min-w-0">
                  <span className="font-semibold">{displayName(a.person)}</span>
                  <span className="text-ink-muted"> · {roleLabel(a.role)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {a.checked_in_at ? (
                    <span className="font-semibold text-success">✓ {formatTime(a.checked_in_at)}</span>
                  ) : (
                    <span className={missing ? "font-bold text-danger" : "text-ink-muted"}>{missing ? "Not here" : "Not yet"}</span>
                  )}
                  <LiveTick assignmentId={a.id} here={!!a.checked_in_at} />
                </span>
              </li>
            );
          })}
          {tbc > 0 && <li className="px-3 text-sm text-ink-muted">+ {tbc} TBC</li>}
        </ul>
      )}
    </div>
  );
}

async function Live({ searchParams }: { searchParams: PageProps<"/admin/live">["searchParams"] }) {
  await requireProducer();
  const { at } = (await searchParams) as { at?: string };
  const { data, error } = await (await createClient())
    .from("sessions")
    .select(
      "id, title, start_time, end_time, session_type, track:tracks!inner(id, name, room, sort_order, running_late_minutes, running_late_updated_at), assignments(id, role, checked_in_at, person:people!inner(salutation, full_name, is_placeholder))",
    )
    .eq("status", "published")
    .order("start_time");
  if (error) throw new Error(error.message);
  const all = (data ?? []) as unknown as Session[];
  const dayStarts = [...new Set(all.map((s) => eventDateKey(s.start_time)))].map(
    (d) => new Date(all.find((s) => eventDateKey(s.start_time) === d)!.start_time).getTime() - DOORS_MIN * 60000,
  );

  // ?at=2026-11-04T12:20 rehearses the view at any moment (Dubai time).
  // Before the forum starts, preview it from the first morning instead of an empty page.
  const real = new Date();
  const preview = !at && !!dayStarts.length && real.getTime() < dayStarts[0];
  const nowDate = at ? new Date(`${at}${/[+Z]/.test(at.slice(10)) ? "" : "+04:00"}`) : preview ? new Date(dayStarts[0]) : real;
  const now = nowDate.getTime();
  const day = eventDateKey(nowDate);
  const nextDayStart = dayStarts.find((t) => t > now);
  // A room running late shifts all of its times, so Now/Next and the 20-minute warnings follow reality.
  const shift = (iso: string, min: number) => new Date(new Date(iso).getTime() + min * 60000).toISOString();
  const today = all
    .filter((s) => eventDateKey(s.start_time) === day)
    .map((s) => {
      const late = s.track.running_late_minutes ?? 0;
      return late
        ? { ...s, planned_start: s.start_time, planned_end: s.end_time, start_time: shift(s.start_time, late), end_time: shift(s.end_time, late) }
        : s;
    });

  const rooms = new Map<string, { track: Session["track"]; sessions: Session[] }>();
  for (const s of today) {
    const r = rooms.get(s.track.id) ?? { track: s.track, sessions: [] };
    r.sessions.push(s);
    rooms.set(s.track.id, r);
  }
  const columns = [...rooms.values()]
    .sort((a, b) => a.track.sort_order - b.track.sort_order)
    .map((r) => {
      const current = r.sessions.find((s) => new Date(s.start_time).getTime() <= now && now < new Date(s.end_time).getTime());
      const next = r.sessions.find((s) => new Date(s.start_time).getTime() > now);
      // If a break comes next, also show who's on stage after it.
      const then =
        next && next.session_type !== "speaking"
          ? r.sessions.find((s) => s.start_time >= next.end_time && s.session_type === "speaking")
          : undefined;
      return { ...r, current, next, then };
    })
    .filter((r) => r.current || r.next);

  const missing = columns.flatMap((r) =>
    [r.current, r.next]
      .filter((s): s is Session => !!s && s.session_type === "speaking" && (new Date(s.start_time).getTime() - now) / 60000 <= WARN_MIN)
      .flatMap((s) => s.assignments.filter((a) => !a.person.is_placeholder && !a.checked_in_at)),
  );

  return (
    <>
      <p className="mt-1 text-ink-muted">
        {formatLongDay(nowDate.toISOString())} · {formatTime(nowDate.toISOString())} {ev.timezoneLabel}
        {preview && (
          <>
            {" "}
            · <span className="font-semibold text-warning">Preview: the forum hasn&apos;t started yet</span>
          </>
        )}
        {at && (
          <>
            {" "}
            · <span className="font-semibold text-warning">Rehearsal time</span> ·{" "}
            <Link href="/admin/live" className="underline">
              back to now
            </Link>
          </>
        )}
      </p>
      {(at || preview) && (
        <nav aria-label="Rehearsal time" className="mt-3 flex flex-wrap gap-2">
          {[
            { label: "Start of day", t: dayStarts.find((t) => eventDateKey(new Date(t)) === day) ?? dayStarts[0] },
            { label: "− 15 min", t: now - 15 * 60000 },
            { label: "+ 15 min", t: now + 15 * 60000 },
            { label: "+ 1 hour", t: now + 60 * 60000 },
            ...(nextDayStart && eventDateKey(new Date(nextDayStart)) !== day ? [{ label: "Next day", t: nextDayStart }] : []),
          ].map((b) => (
            <Link
              key={b.label}
              href={`/admin/live?at=${dubaiStamp(b.t)}`}
              className="flex h-10 items-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold"
            >
              {b.label}
            </Link>
          ))}
        </nav>
      )}
      {!today.length ? (
        <div className="mt-8 rounded-2xl bg-surface p-6 shadow-[0_1px_0_var(--line)]">
          <p className="font-semibold">No sessions today.</p>
          {nextDayStart && (
            <p className="mt-1 text-ink-muted">
              This view comes alive on the event days.{" "}
              <Link href={`/admin/live?at=${dubaiStamp(nextDayStart)}`} className="font-semibold text-brand-strong underline">
                Rehearse the next day from the start
              </Link>
              .
            </p>
          )}
        </div>
      ) : !columns.length ? (
        <p className="mt-8 rounded-2xl bg-surface p-6 text-ink-muted">
          That&apos;s a wrap for today.
          {nextDayStart && (
            <>
              {" "}
              <Link href={`/admin/live?at=${dubaiStamp(nextDayStart)}`} className="font-semibold text-brand-strong underline">
                Rehearse the next day
              </Link>
            </>
          )}
        </p>
      ) : (
        <>
          <p className={`mt-4 rounded-2xl px-5 py-3 font-semibold ${missing.length ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
            {missing.length
              ? `${missing.length} ${missing.length === 1 ? "person" : "people"} due on stage within ${WARN_MIN} minutes not checked in`
              : "Everyone due on stage in the next 20 minutes is here"}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {columns.map((r) => (
              <section key={r.track.id} className="rounded-2xl bg-surface p-5 shadow-[0_1px_0_var(--line)]">
                <h2 className="font-display text-2xl font-semibold">{r.track.room ?? "Room TBC"}</h2>
                <p className="mb-3 text-sm text-ink-muted">{r.track.name}</p>
                <RoomDelay
                  trackId={r.track.id}
                  minutes={r.track.running_late_minutes ?? 0}
                  setAt={r.track.running_late_updated_at ? formatTime(r.track.running_late_updated_at) : null}
                />
                {r.current && <SessionBlock s={r.current} kind="Now" now={now} />}
                {r.next && <SessionBlock s={r.next} kind="Next" now={now} />}
                {r.then && <SessionBlock s={r.then} kind="Then" now={now} />}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function LivePage({ searchParams }: PageProps<"/admin/live">) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold">Live</h1>
        <Link href="/admin/print?view=rooms" className="flex h-10 items-center rounded-xl border border-line bg-surface px-4 text-sm font-semibold">
          Print backup
        </Link>
      </div>
      <LiveRefresh />
      <AutoRefresh seconds={60} />
      <Suspense fallback={<div aria-busy="true" className="mt-8 h-96 animate-pulse rounded-2xl bg-surface" />}>
        <Live searchParams={searchParams} />
      </Suspense>
    </>
  );
}
