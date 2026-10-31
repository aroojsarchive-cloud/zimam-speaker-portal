import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getMe } from "@/lib/me";
import { getRunSheet, type RunSheetSession } from "@/lib/speaker-data";
import { displayName, formatLabel, roleLabel } from "@/lib/labels";
import { eventDateKey, eventToday, formatLongDay, formatRange, formatTime, nowMs, shifted } from "@/lib/time";
import { ScheduleNotice } from "@/components/ScheduleNotice";
import { RunningLateBanner } from "@/components/Banners";
import { PrintButton } from "@/components/PrintButton";
import { arriveBy, ARRIVE_BEFORE_MIN } from "@/lib/prep";
import { CheckIn } from "@/components/CheckIn";

export const metadata: Metadata = { title: "Run sheet" };

const ROLE_ORDER = ["chair", "co_chair", "moderator", "keynote", "speaker", "panelist", "jury", "mc", "host"];

function introLine(p: RunSheetSession["assignments"][number]["person"]) {
  return [p.title, p.organisation].filter(Boolean).join(", ");
}

async function RunSheet({ params }: { params: PageProps<"/host/[trackId]">["params"] }) {
  const { trackId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(trackId)) notFound();
  const me = await getMe();
  const sheet = await getRunSheet(trackId);
  if (!sheet || !sheet.sessions.length) notFound();
  const { track, sessions, hosts } = sheet;
  const mine = hosts.find((h) => h.person.id === me.personId);
  if (!mine && me.appRole !== "producer") notFound();
  const others = hosts.filter((h) => h.person.id !== me.personId);

  const isToday = eventDateKey(sessions[0].start_time) === eventToday();
  const late = isToday ? (track.running_late_minutes ?? 0) : 0;
  const at = (iso: string) => (late ? shifted(iso, late) : iso);
  const now = nowMs();
  const currentId = isToday
    ? sessions.find((s) => new Date(at(s.start_time)).getTime() <= now && now < new Date(at(s.end_time)).getTime())?.id
    : undefined;
  const nextId = isToday ? sessions.find((s) => new Date(at(s.start_time)).getTime() > now)?.id : undefined;
  const first = sessions[0].start_time;
  const onStage = sessions.find((s) => s.session_type === "speaking")?.start_time ?? first;
  const last = sessions.map((s) => s.end_time).sort().at(-1)!;

  return (
    <>
      <div className="print:hidden">
        <Link href="/" className="mb-3 inline-flex h-11 items-center text-[0.95rem] font-semibold text-ink-muted hover:text-ink">
          ‹ My event
        </Link>
      </div>
      <p className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-brand-strong">
        Your run sheet · {roleLabel(mine?.role ?? "mc")}
      </p>
      <h1 className="mt-2 font-display text-[1.9rem] font-semibold leading-tight">{track.name}</h1>
      <p className="mt-1 text-ink-muted">
        {formatLongDay(first)} · {formatRange(first, last)} · {track.room ?? "Room TBC"}
      </p>
      {others.length > 0 && (
        <p className="mt-1 text-ink-muted">
          With {others.map((h) => `${displayName(h.person)} (${roleLabel(h.role)})`).join(", ")}
        </p>
      )}
      <p className="mt-4 rounded-2xl bg-ink px-5 py-4 text-white">
        <span className="block font-display text-xl font-semibold">
          Please be in {track.room ?? "the room"} by {formatTime(arriveBy(at(onStage)))}
        </span>
        <span className="text-[0.95rem] text-white/85">
          {formatLongDay(onStage)}, {ARRIVE_BEFORE_MIN} minutes before the programme starts at {formatTime(at(onStage))}.
        </span>
      </p>
      {isToday && mine && (
        <div className="mt-3 print:hidden">
          <CheckIn hostTrackId={track.id} checkedInAt={mine.checked_in_at} />
        </div>
      )}

      <div className="mt-4 space-y-3 print:hidden">
        {late > 0 && <RunningLateBanner room={track.room ?? "Your room"} minutes={late} startsAround={formatTime(at(first))} />}
        <ScheduleNotice compact />
      </div>
      {isToday && (
        <p className="mt-3 text-sm text-ink-muted print:hidden">✓ means the speaker has checked in and is in the room.</p>
      )}

      <ol className="mt-5 space-y-3" aria-label="Running order">
        {sessions.map((s) => {
          const people = [...s.assignments].sort(
            (a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.sort_order - b.sort_order,
          );
          const tag = s.id === currentId ? "Now" : s.id === nextId ? "Next" : null;
          if (s.session_type !== "speaking")
            return (
              <li key={s.id} className="flex gap-4 rounded-2xl px-5 py-3 text-ink-muted ring-1 ring-line">
                <span className="w-28 shrink-0 whitespace-nowrap font-semibold tabular-nums">{formatRange(at(s.start_time), at(s.end_time))}</span>
                <span>
                  {s.title}
                  {s.format === "break" && <span className="block text-sm">Announce: back in the room by {formatTime(at(s.end_time))}</span>}
                </span>
              </li>
            );
          return (
            <li
              key={s.id}
              className={`break-inside-avoid rounded-3xl bg-surface p-5 shadow-[0_1px_0_var(--line)] ${tag === "Now" ? "ring-2 ring-brand" : ""}`}
            >
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="whitespace-nowrap font-semibold tabular-nums">{formatRange(at(s.start_time), at(s.end_time))}</span>
                <span className="text-sm text-ink-muted">{s.label ?? formatLabel(s.format)}</span>
                {tag && (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${tag === "Now" ? "bg-brand text-white" : "bg-ink text-white"}`}>
                    {tag}
                  </span>
                )}
              </div>
              <h2 className="mt-1 font-display text-lg font-semibold leading-snug">{s.title}</h2>
              {people.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {people.map((a, i) => (
                    <li key={`${a.person.id}-${a.role}-${i}`} className="leading-snug">
                      <span className="text-sm text-ink-muted">{roleLabel(a.role)}: </span>
                      <span className="font-semibold">{a.person.is_placeholder ? a.person.full_name : displayName(a.person)}</span>
                      {isToday && a.checked_in_at && <span className="ml-1.5 font-semibold text-success">✓</span>}
                      {!a.person.is_placeholder && introLine(a.person) && (
                        <span className="block text-[0.95rem] text-ink-muted">{introLine(a.person)}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">No speakers listed.</p>
              )}
              {s.description && (
                <details className="mt-3 text-[0.95rem]">
                  <summary className="cursor-pointer font-semibold text-brand-strong">About this session</summary>
                  <p className="mt-2 leading-relaxed text-ink-muted">{s.description}</p>
                </details>
              )}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 print:hidden">
        <PrintButton />
      </div>
    </>
  );
}

export default function HostPage({ params }: PageProps<"/host/[trackId]">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-4">
      <Suspense fallback={<div aria-busy="true" className="h-96 animate-pulse rounded-3xl bg-surface" />}>
        <RunSheet params={params} />
      </Suspense>
    </main>
  );
}
