import type { Metadata } from "next";
import { Suspense } from "react";
import { eventConfig as ev } from "@/config/event";
import { requireProducer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { displayName, roleLabel } from "@/lib/labels";
import { formatDay, formatLongDay, formatRange, formatStamp } from "@/lib/time";
import { SLIDES_DUE_DAYS_BEFORE } from "@/config/guidelines";

export const metadata: Metadata = { title: "Slides" };

type Session = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  track: { name: string; room: string | null };
  assignments: {
    role: string;
    presents: boolean;
    no_slides: boolean;
    slides_sent_at: string | null;
    person: { id: string; salutation: string | null; full_name: string; is_placeholder: boolean };
  }[];
};

async function SlidesList() {
  await requireProducer();
  const { data, error } = await (await createClient())
    .from("sessions")
    .select(
      "id, title, start_time, end_time, track:tracks!inner(name, room), assignments(role, presents, no_slides, slides_sent_at, person:people!inner(id, salutation, full_name, is_placeholder))",
    )
    .eq("session_type", "speaking")
    .eq("status", "published")
    .order("start_time");
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as unknown as Session[])
    .map((s) => ({ ...s, presenters: s.assignments.filter((a) => !a.person.is_placeholder && a.presents) }))
    .filter((s) => s.presenters.length);
  const all = rows.flatMap((s) => s.presenters);
  const sent = all.filter((a) => a.slides_sent_at).length;
  const none = all.filter((a) => !a.slides_sent_at && a.no_slides).length;

  return (
    <>
      <p className="mt-2 max-w-3xl text-ink-muted">
        Presenters email their slides to <span className="font-semibold text-ink">{ev.slidesEmail}</span> and tick &ldquo;I&apos;ve
        emailed them&rdquo; in the portal. <span className="font-semibold text-ink">{sent}</span> of {all.length} say they&apos;ve sent
        them; {none} aren&apos;t using slides. Only people marked as presenting are listed.
      </p>
      <div className="mt-6 space-y-4">
        {rows.map((s) => {
          const due = formatLongDay(new Date(new Date(s.start_time).getTime() - SLIDES_DUE_DAYS_BEFORE * 86400000).toISOString());
          return (
            <section key={s.id} className="rounded-2xl bg-surface p-5 shadow-[0_1px_0_var(--line)]">
              <p className="text-sm text-ink-muted">
                {formatDay(s.start_time)} · {formatRange(s.start_time, s.end_time)} · {s.track.room ?? "Room TBC"} · {s.track.name} · due{" "}
                {due}
              </p>
              <h2 className="font-semibold">{s.title}</h2>
              <ul className="mt-3 divide-y divide-line">
                {s.presenters.map((a) => (
                  <li key={a.person.id + a.role} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      <span className="font-semibold">{displayName(a.person)}</span>{" "}
                      <span className="text-ink-muted">· {roleLabel(a.role)}</span>
                    </span>
                    {a.slides_sent_at ? (
                      <span className="font-semibold text-success">✓ Says sent · {formatStamp(a.slides_sent_at)}</span>
                    ) : a.no_slides ? (
                      <span className="text-ink-muted">Not using slides</span>
                    ) : (
                      <span className="font-semibold text-warning">Not yet</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

export default function SlidesPage() {
  return (
    <>
      <h1 className="font-display text-4xl font-semibold">Slides</h1>
      <Suspense fallback={<div aria-busy="true" className="mt-8 h-96 animate-pulse rounded-2xl bg-surface" />}>
        <SlidesList />
      </Suspense>
    </>
  );
}
