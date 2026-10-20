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

export const metadata: Metadata = { title: "Live" };

const WARN_MIN = 20; // speakers are asked to be in the room 20 minutes before

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
  track: { id: string; name: string; room: string | null; sort_order: number };
  assignments: Assignment[];
};

function SessionBlock({ s, kind, now }: { s: Session; kind: "Now" | "Next"; now: number }) {
  const people = s.assignments.filter((a) => !a.person.is_placeholder);
  const tbc = s.assignments.length - people.length;
  const startsIn = (new Date(s.start_time).getTime() - now) / 60000;
  const urgent = startsIn <= WARN_MIN;
  return (
    <div className={kind === "Now" ? "" : "mt-4 border-t border-line pt-4"}>
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
        {kind} · {formatRange(s.start_time, s.end_time)}
        {kind === "Next" && startsIn > 0 && ` · in ${Math.round(startsIn)} min`}
      </p>
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
  // ?at=2026-11-04T12:20 rehearses the view at any moment (Dubai time).
  const nowDate = at ? new Date(`${at}${/[+Z]/.test(at.slice(10)) ? "" : "+04:00"}`) : new Date();
  const now = nowDate.getTime();
  const day = eventDateKey(nowDate);

  const { data, error } = await (await createClient())
    .from("sessions")
    .select(
      "id, title, start_time, end_time, session_type, track:tracks!inner(id, name, room, sort_order), assignments(id, role, checked_in_at, person:people!inner(salutation, full_name, is_placeholder))",
    )
    .order("start_time");
  if (error) throw new Error(error.message);
  const today = ((data ?? []) as unknown as Session[]).filter((s) => eventDateKey(s.start_time) === day);

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
      return { ...r, current, next };
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
      {!today.length ? (
        <div className="mt-8 rounded-2xl bg-surface p-6 shadow-[0_1px_0_var(--line)]">
          <p className="font-semibold">No sessions today.</p>
          <p className="mt-1 text-ink-muted">
            This view comes alive on the event days. To rehearse it, try{" "}
            <Link href="/admin/live?at=2026-11-04T14:35" className="font-semibold text-brand-strong underline">
              4 Nov at 14:35
            </Link>
            .
          </p>
        </div>
      ) : !columns.length ? (
        <p className="mt-8 rounded-2xl bg-surface p-6 text-ink-muted">That&apos;s a wrap for today.</p>
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
                <p className="mb-4 text-sm text-ink-muted">{r.track.name}</p>
                {r.current && <SessionBlock s={r.current} kind="Now" now={now} />}
                {r.next && <SessionBlock s={r.next} kind="Next" now={now} />}
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
      <h1 className="font-display text-4xl font-semibold">Live</h1>
      <LiveRefresh />
      <AutoRefresh seconds={60} />
      <Suspense fallback={<div aria-busy="true" className="mt-8 h-96 animate-pulse rounded-2xl bg-surface" />}>
        <Live searchParams={searchParams} />
      </Suspense>
    </>
  );
}
