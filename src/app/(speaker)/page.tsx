import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { eventConfig as ev } from "@/config/event";
import { firstName, getMe } from "@/lib/me";
import { getEventInfo, getMyEngagements, getMyProfile, signedUrls, type Engagement } from "@/lib/speaker-data";
import { displayName } from "@/lib/labels";
import { BoardingCard } from "@/components/BoardingCard";
import { ConfirmDetails } from "@/components/ConfirmDetails";
import { ContactCard } from "@/components/ContactCard";
import { ChangedBanner, RunningLateBanner } from "@/components/Banners";
import { MarkSeen } from "@/components/MarkSeen";
import { Checklist } from "@/components/Checklist";
import { needsSlides, prepSteps, type PrepEngagement } from "@/lib/prep";
import { CheckIn } from "@/components/CheckIn";
import { eventDateKey, eventToday, formatTime, notFinished, shifted } from "@/lib/time";
import { signOut } from "@/app/auth/confirm/actions";

async function MyEventContent() {
  const me = await getMe();
  if (me.appRole === "producer") redirect("/admin");

  const [event, profile, engagements] = await Promise.all([
    getEventInfo(me.eventId),
    getMyProfile(me.personId),
    getMyEngagements(me.personId),
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
  });

  // One card per session, even if the person holds two roles in it.
  const bySession = new Map<string, { e: Engagement; roles: string[] }>();
  for (const e of engagements) {
    const hit = bySession.get(e.session.id);
    if (hit) hit.roles.push(e.role);
    else bySession.set(e.session.id, { e, roles: [e.role] });
  }
  const cards = [...bySession.values()];
  const n = cards.length;

  // "What changed": the newest edit to any of my sessions or their published briefs.
  const latest = engagements
    .flatMap((e) => [e.session.updated_at, ...e.session.notes.filter((x) => x.kind === "published").map((x) => x.updated_at)])
    .sort()
    .at(-1);
  const changed = latest && profile.last_seen_changes_at && latest > profile.last_seen_changes_at ? latest : null;

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
        {changed && <ChangedBanner at={changed} />}
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

      {n > 0 && (
        <div className="mt-4">
          <Checklist steps={steps} />
        </div>
      )}

      {n > 0 && (
        <p className="mt-6 font-display text-[1.6rem] font-semibold leading-tight">
          You have {n === 1 ? "one session" : `${n} sessions`} at {ev.shortName}.
        </p>
      )}

      {n === 0 ? (
        <div className="mt-8 rounded-3xl bg-surface p-6 shadow-[0_1px_0_var(--line)]">
          <p className="font-semibold">Your sessions are being finalised</p>
          <p className="mt-1 text-ink-muted">We&apos;ll email you as soon as your session details are ready.</p>
        </div>
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
      <MarkSeen />
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
