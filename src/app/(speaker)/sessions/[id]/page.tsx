import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { eventConfig as ev } from "@/config/event";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { getSessionDetail, signedUrls } from "@/lib/speaker-data";
import { displayName, formatLabel, roleLabel } from "@/lib/labels";
import { eventDateKey, eventToday, formatLongDay, formatRange, formatTime, minutesBetween, shifted } from "@/lib/time";
import { RunningOrder } from "@/components/RunningOrder";
import { ScheduleNotice } from "@/components/ScheduleNotice";
import { StageList } from "@/components/StageList";
import { Brief } from "@/components/Brief";
import { CheckIn } from "@/components/CheckIn";
import { SlidesByEmail } from "@/components/SlidesByEmail";
import { eventConfig as evc } from "@/config/event";
import { ReviewedButton } from "@/components/PrepButtons";
import { arriveBy } from "@/lib/prep";
import { SLIDES_DUE_DAYS_BEFORE } from "@/config/guidelines";

export const metadata: Metadata = { title: "Session" };

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-3xl bg-surface p-5 shadow-[0_1px_0_var(--line)]">
      <h2 id={id} className="mb-4 font-display text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

async function SessionContent({ params }: { params: PageProps<"/sessions/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await getMe();
  const detail = await getSessionDetail(id);
  if (!detail) notFound();
  const { session: s, trackSessions, stage, note } = detail;

  const { data: mine } = await (await createClient())
    .from("assignments")
    .select("id, role, checked_in_at, reviewed_at, no_slides, presents, slides_sent_at")
    .eq("session_id", id)
    .eq("person_id", me.personId);
  const myRoles = (mine ?? []).map((a) => a.role);
  const myIds = (mine ?? []).map((a) => a.id);
  const reviewed = (mine ?? []).length > 0 && (mine ?? []).every((a) => a.reviewed_at);
  const noSlides = (mine ?? []).length > 0 && (mine ?? []).every((a) => a.no_slides);
  // Only people presenting in this session (set from the programme) are asked for slides.
  const presents = (mine ?? []).some((a) => a.presents) && s.session_type === "speaking";
  const slidesSentAt = (mine ?? []).map((a) => a.slides_sent_at).find(Boolean) ?? null;
  const [photos, files] = await Promise.all([
    signedUrls("photos", stage.map((m) => m.person.photo_path)),
    signedUrls("briefs", [note?.file_path ?? null]),
  ]);
  const isToday = eventDateKey(s.start_time) === eventToday();
  // On the day, if the producer has marked this room as running late, times move with it.
  const lateBy = isToday ? (s.track.running_late_minutes ?? 0) : 0;
  const expectedStart = shifted(s.start_time, lateBy);

  return (
    <>
      {/* Hero: the answer to where, when, what am I doing */}
      <section className="overflow-hidden rounded-3xl bg-ink text-white">
        <div className="h-1.5" style={{ background: s.track.colour ?? ev.colours.brand }} />
        <div className="p-5">
          <p className="text-sm text-white/70">
            {s.track.name} · {formatLabel(s.format)}
          </p>
          <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-[1.12]">{s.title}</h1>
          {myRoles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {myRoles.map((r) => (
                <span key={r} className="rounded-full bg-brand px-3 py-1 text-sm font-semibold text-white">
                  You: {roleLabel(r)}
                </span>
              ))}
            </div>
          )}
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-white/15 pt-4 font-display">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Time</dt>
              <dd className="whitespace-nowrap text-[1.7rem] font-semibold leading-none tabular-nums">{formatRange(s.start_time, s.end_time)}</dd>
            </div>
            <div className="text-right">
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">Room</dt>
              <dd className="text-[1.9rem] font-semibold leading-none">{s.track.room ?? "TBC"}</dd>
            </div>
          </dl>
          {lateBy > 0 && (
            <p role="status" className="mt-3 rounded-lg bg-warning px-3 py-2 text-sm font-semibold text-white">
              {s.track.room ?? "This room"} is running about {lateBy} minutes late. This session should now start around{" "}
              {formatTime(expectedStart)}.
            </p>
          )}
          {myRoles.length > 0 && (
            <Link href="/guidelines" className="mt-3 block text-sm font-semibold text-white underline underline-offset-4">
              Speaker guidelines: timing and slides ›
            </Link>
          )}
          {myRoles.length > 0 && (
            <p className="mt-3 rounded-lg bg-white/10 px-3 py-2 text-sm">
              Please be in {s.track.room ?? "the room"} by <span className="font-semibold">{formatTime(arriveBy(expectedStart))}</span>, 20 minutes before you start.
            </p>
          )}
          <p className="mt-3 text-sm text-white/70">
            {formatLongDay(s.start_time)} · {minutesBetween(s.start_time, s.end_time)} min · {ev.timezoneLabel}
          </p>
          <a
            href={`/sessions/${s.id}/calendar.ics`}
            className="mt-5 flex h-12 items-center justify-center rounded-xl bg-white font-semibold text-ink"
          >
            Add to calendar
          </a>
        </div>
      </section>

      {isToday && mine?.[0] && (
        <div className="mt-4">
          <CheckIn assignmentId={mine[0].id} sessionId={s.id} checkedInAt={mine.find((a) => a.checked_in_at)?.checked_in_at ?? null} />
        </div>
      )}

      <div className="mt-4 space-y-4">
        <Section id="order-h" title={`Where this sits${s.track.room ? ` in ${s.track.room}` : ""}`}>
          <RunningOrder sessions={trackSessions} currentId={s.id} />
          <div className="mt-3">
            <ScheduleNotice compact />
          </div>
          {myIds.length > 0 && s.session_type === "speaking" && (
            <div id="review">
              <ReviewedButton ids={myIds} sessionId={s.id} reviewed={reviewed} />
            </div>
          )}
        </Section>

        {s.session_type === "speaking" && (
          <Section id="stage-h" title="Who's on stage">
            <StageList members={stage} me={me.personId} photos={photos} />
          </Section>
        )}

        {s.description && (
          <Section id="about-h" title="About this session">
            <p className="leading-relaxed">{s.description}</p>
          </Section>
        )}

        {presents && (
          <Section id="slides-h" title="Your slides">
            <SlidesByEmail
              ids={myIds}
              sessionId={s.id}
              email={evc.slidesEmail}
              due={formatLongDay(new Date(new Date(s.start_time).getTime() - SLIDES_DUE_DAYS_BEFORE * 86400000).toISOString())}
              subject={`Slides: ${displayName({ salutation: me.salutation, full_name: me.fullName })} · ${s.title}`}
              sentAt={slidesSentAt}
              noSlides={noSlides}
            />
          </Section>
        )}

        {s.session_type === "speaking" && (
          <Section id="brief-h" title="Your brief">
            {myRoles.includes("moderator") && (
              <Link
                href={`/sessions/${s.id}/brief`}
                className="mb-4 flex h-12 items-center justify-center rounded-xl bg-ink font-semibold text-white"
              >
                {note ? "Edit the brief" : "Write the brief for your panel"}
              </Link>
            )}
            <Brief note={note} me={me.personId} meName={me.fullName} fileUrl={note?.file_path ? (files.get(note.file_path) ?? null) : null} />
          </Section>
        )}
      </div>
    </>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading session">
      <div className="h-72 animate-pulse rounded-3xl bg-ink/80" />
      <div className="mt-4 h-64 animate-pulse rounded-3xl bg-surface shadow-[0_1px_0_var(--line)]" />
    </div>
  );
}

export default function SessionPage({ params }: PageProps<"/sessions/[id]">) {
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-16 pt-4">
      <Link href="/" className="mb-3 inline-flex h-11 items-center text-[0.95rem] font-semibold text-ink-muted hover:text-ink">
        ‹ My event
      </Link>
      <Suspense fallback={<Skeleton />}>
        <SessionContent params={params} />
      </Suspense>
    </main>
  );
}
