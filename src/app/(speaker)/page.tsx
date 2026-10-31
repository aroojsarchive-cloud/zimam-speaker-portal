import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { eventConfig as ev } from "@/config/event";
import { firstName, getMe } from "@/lib/me";
import { getEventInfo, getMyEngagements, getMyHosting, getMyProfile, signedUrls, span, type Engagement } from "@/lib/speaker-data";
import { displayName, roleLabel } from "@/lib/labels";
import { BoardingCard } from "@/components/BoardingCard";
import { ConfirmDetails } from "@/components/ConfirmDetails";
import { ContactCard } from "@/components/ContactCard";
import { RunningLateBanner } from "@/components/Banners";
import { Checklist } from "@/components/Checklist";
import { arriveBy, needsSlides, prepSteps, type PrepEngagement } from "@/lib/prep";
import { CheckIn } from "@/components/CheckIn";
import { eventDateKey, eventToday, formatDay, formatRange, formatTime, notFinished, shifted } from "@/lib/time";
import { signOut } from "@/app/auth/confirm/actions";

async function MyEventContent() {
  const me = await getMe();
  if (me.appRole === "producer") redirect("/admin");

  const [event, profile, engagements, hosting] = await Promise.all([
    getEventInfo(me.eventId),
    getMyProfile(me.personId),
    getMyEngagements(me.personId),
    getMyHosting(me.personId),
  ]);
  const photos = await signedUrls("photos", [profile.photo_path]);
  const today = eventToday();
  // Today's sessions in rooms the producer has marked as running late (and not yet finished).
  const late = engagements.filter(
    (e, i, all) =>
      (e.session.track.running_late_minutes ?? 0) > 0 &&
      eventDateKey(e.session.start_time) === today &&
      notFinished(e.session.end_time, e.session.track.running_late_minutes) &&
      all.findIndex((x) => x.session.id === e.session.id) === i,
  );
  const photoUrl = profile.photo_path ? (photos.get(profile.photo_path) ?? null) : null;

  const prep: PrepEngagement[] = engagements.map((e) => ({
    assignmentId: e.id,
    role: e.role,
    sessionId: e.session.id,
    sessionTitle: e.session.title,
    speaking: e.session.session_type === "speaking",
    // On the day, a late room moves the "be in the room by" time too.
    start:
      eventDateKey(e.session.start_time) === today ? shifted(e.session.start_time, e.session.track.running_late_minutes ?? 0) : e.session.start_time,
    room: e.session.track.room,
    reviewedAt: e.reviewed_at,
    noSlides: e.no_slides,
    hasSlides: !!e.slides_sent_at,
    presents: e.presents,
    briefPublished: e.session.notes.some((x) => x.kind === "published"),
    checkedInAt: e.checked_in_at,
  }));
  const steps = prepSteps({
    detailsConfirmed: profile.details_status === "confirmed",
    guidelinesAck: !!profile.guidelines_ack_at,
    engagements: prep,
    hosting: hosting.map((h) => {
      const { onStage } = span(h);
      const late = eventDateKey(onStage) === today ? (h.track.running_late_minutes ?? 0) : 0;
      return { trackId: h.track.id, room: h.track.room, start: late ? shifted(onStage, late) : onStage, checkedInAt: h.checked_in_at };
    }),
  });

  const briefsTodo = prep.filter(
    (p, i, all) => p.role === "moderator" && !p.briefPublished && all.findIndex((x) => x.sessionId === p.sessionId && x.role === "moderator") === i,
  );

  // One card per session, even if the person holds two roles in it.
  const bySession = new Map<string, { e: Engagement; roles: string[] }>();
  for (const e of engagements) {
    const hit = bySession.get(e.session.id);
    if (hit) hit.roles.push(e.role);
    else bySession.set(e.session.id, { e, roles: [e.role] });
  }
  const cards = [...bySession.values()];
  const n = cards.length;

  return (
    <>
      <div className="space-y-3">
        {late.map((e) => (
          <RunningLateBanner
            key={e.id}
            room={e.session.track.room ?? "Your room"}
            minutes={e.session.track.running_late_minutes}
            startsAround={formatTime(shifted(e.session.start_time, e.session.track.running_late_minutes))}
          />
        ))}
      </div>

      <div className="mt-4">
        <ConfirmDetails
          profile={{
            id: profile.id,
            firstName: firstName(me.fullName),
            displayName: displayName(profile),
            title: profile.title,
            organisation: profile.organisation,
            photoUrl,
            status: profile.details_status,
            changeNote: profile.change_request_note,
          }}
        />
      </div>

      {/* Moderators: the brief is the one thing only they can do, so ask up front. */}
      {briefsTodo.map((b) => (
        <div key={b.sessionId} className="mt-4 rounded-3xl bg-brand-soft p-5">
          <p className="text-sm font-semibold uppercase tracking-[0.1em] text-brand-strong">You&apos;re moderating</p>
          <p className="mt-1 font-display text-xl font-semibold leading-snug">{b.sessionTitle}</p>
          <p className="mt-2 leading-relaxed">
            Please write a short brief for your panel: what the session should achieve and the questions you plan to ask. Paste it in, or
            simply upload your concept note.
          </p>
          <Link
            href={`/sessions/${b.sessionId}/brief`}
            className="mt-3 flex h-12 items-center justify-center rounded-xl bg-brand-strong font-semibold text-white"
          >
            Write your brief
          </Link>
        </div>
      ))}

      {steps.length > 0 && (
        <div className="mt-4">
          <Checklist steps={steps} />
        </div>
      )}

      {hosting.length > 0 && (
        <section aria-labelledby="hosting-h" className="mt-6">
          <h2 id="hosting-h" className="font-display text-[1.6rem] font-semibold leading-tight">
            You&apos;re hosting
          </h2>
          <ul className="mt-3 space-y-3">
            {hosting.map((h) => {
              const { start, end, onStage } = span(h);
              return (
                <li key={h.track.id}>
                  <Link
                    href={`/host/${h.track.id}`}
                    className="flex items-center justify-between gap-4 rounded-3xl bg-ink p-5 text-white shadow-[0_1px_0_var(--line)]"
                  >
                    <span>
                      <span className="text-sm font-semibold uppercase tracking-[0.08em] text-white/70">{roleLabel(h.role)}</span>
                      <span className="block font-display text-xl font-semibold leading-snug">{h.track.name}</span>
                      <span className="block text-white/80">
                        {formatDay(start)} · {formatRange(start, end)} · {h.track.room ?? "Room TBC"}
                      </span>
                      <span className="mt-2 block font-semibold text-brand-soft">
                        Be in {h.track.room ?? "the room"} by {formatTime(arriveBy(onStage))}
                      </span>
                      <span className="mt-1 block font-semibold">Open your run sheet ›</span>
                    </span>
                  </Link>
                  {eventDateKey(onStage) === today && (
                    <div className="mt-3">
                      <CheckIn hostTrackId={h.track.id} checkedInAt={h.checked_in_at} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {n > 0 && (
        <p className="mt-6 font-display text-[1.6rem] font-semibold leading-tight">
          You have {n === 1 ? "one session" : `${n} sessions`} at {ev.shortName}.
        </p>
      )}

      {n === 0 ? (
        hosting.length > 0 ? null : (
        <div className="mt-8 rounded-3xl bg-surface p-6 shadow-[0_1px_0_var(--line)]">
          <p className="font-semibold">Your sessions are being finalised</p>
          <p className="mt-1 text-ink-muted">We&apos;ll email you as soon as your session details are ready.</p>
        </div>
        )
      ) : (
        <ol className="mt-6 space-y-4" aria-label="My sessions">
          {cards.map(({ e, roles }) => (
            <li key={e.session.id}>
              <BoardingCard
                e={e}
                roles={roles}
                lateBy={eventDateKey(e.session.start_time) === today ? (e.session.track.running_late_minutes ?? 0) : 0}
                slides={(() => {
                  const mine = prep.filter((p) => p.sessionId === e.session.id && needsSlides(p));
                  if (!mine.length) return null;
                  if (mine.some((p) => p.hasSlides)) return "received";
                  return mine.every((p) => p.noSlides) ? null : "needed";
                })()}
              />
              {eventDateKey(e.session.start_time) === today && (
                <div className="mt-3">
                  <CheckIn
                    assignmentId={e.id}
                    sessionId={e.session.id}
                    checkedInAt={engagements.find((x) => x.session.id === e.session.id && x.checked_in_at)?.checked_in_at ?? null}
                  />
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-center text-sm text-ink-muted">
        All times are {ev.timezoneLabel}. Timings may change, so please check back closer to the day.
      </p>

      <div className="mt-8 space-y-4">
        <ContactCard
          name={event.producer_name ?? ev.fallbackContact.name}
          phone={event.producer_phone}
          whatsapp={event.producer_whatsapp}
        />
      </div>

      <Link
        href="/agenda"
        className="mt-4 flex h-14 items-center justify-between rounded-2xl border border-line px-5 font-semibold"
      >
        See the full agenda <span aria-hidden>›</span>
      </Link>
    </>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your sessions">
      <div className="mt-6 h-9 w-2/5 animate-pulse rounded-lg bg-line" />
      <div className="mt-2 h-9 w-4/5 animate-pulse rounded-lg bg-line" />
      {[0, 1].map((i) => (
        <div key={i} className="mt-6 h-64 animate-pulse rounded-3xl bg-surface shadow-[0_1px_0_var(--line)]" />
      ))}
    </div>
  );
}

export default function MyEvent() {
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-16 pt-5">
      <Suspense fallback={<Skeleton />}>
        <MyEventContent />
      </Suspense>
      <form action={signOut} className="mt-10 text-center">
        <button className="h-11 px-3 text-sm text-ink-muted underline-offset-4 hover:underline">Sign out</button>
      </form>
    </main>
  );
}
