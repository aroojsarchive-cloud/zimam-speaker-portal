import type { Metadata } from "next";
import { Suspense } from "react";
import { requireProducer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/speaker-data";
import { displayName, roleLabel } from "@/lib/labels";
import { formatDay, formatRange, formatStamp } from "@/lib/time";

export const metadata: Metadata = { title: "Slides" };

type Session = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  track: { name: string; room: string | null };
  assignments: { role: string; presents: boolean; person: { id: string; salutation: string | null; full_name: string; is_placeholder: boolean } }[];
};
type Submission = { session_id: string; person_id: string; file_name: string; file_path: string; uploaded_at: string; size_bytes: number | null };

async function SlidesList() {
  await requireProducer();
  const supabase = await createClient();
  const [{ data: sessions, error }, { data: subs }] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, title, start_time, end_time, track:tracks!inner(name, room), assignments(role, presents, person:people!inner(id, salutation, full_name, is_placeholder))")
      .eq("session_type", "speaking")
      .order("start_time"),
    supabase.from("slide_submissions").select("session_id, person_id, file_name, file_path, uploaded_at, size_bytes").order("uploaded_at", { ascending: false }),
  ]);
  if (error) throw new Error(error.message);

  // Latest file per person per session.
  const latest = new Map<string, Submission>();
  for (const s of (subs ?? []) as Submission[]) {
    const k = `${s.session_id}/${s.person_id}`;
    if (!latest.has(k)) latest.set(k, s);
  }
  const urls = await signedUrls("slides", [...latest.values()].map((s) => s.file_path), 6 * 3600);

  const rows = ((sessions ?? []) as unknown as Session[])
    .map((s) => ({ ...s, presenters: s.assignments.filter((a) => !a.person.is_placeholder && a.presents) }))
    .filter((s) => s.presenters.length);
  const total = rows.reduce((n, s) => n + s.presenters.length, 0);
  const received = rows.reduce((n, s) => n + s.presenters.filter((a) => latest.has(`${s.id}/${a.person.id}`)).length, 0);

  return (
    <>
      <p className="mt-2 text-ink-muted">
        <span className="font-semibold text-ink">{received}</span> of {total} presenters have uploaded. Only people marked as
        presenting are listed; panelists and moderators aren&apos;t asked for slides.
      </p>
      <div className="mt-6 space-y-4">
        {rows.map((s) => (
          <section key={s.id} className="rounded-2xl bg-surface p-5 shadow-[0_1px_0_var(--line)]">
            <p className="text-sm text-ink-muted">
              {formatDay(s.start_time)} · {formatRange(s.start_time, s.end_time)} · {s.track.room ?? "Room TBC"} · {s.track.name}
            </p>
            <h2 className="font-semibold">{s.title}</h2>
            <ul className="mt-3 divide-y divide-line">
              {s.presenters.map((a) => {
                const sub = latest.get(`${s.id}/${a.person.id}`);
                const url = sub ? urls.get(sub.file_path) : null;
                return (
                  <li key={a.person.id + a.role} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      <span className="font-semibold">{displayName(a.person)}</span>{" "}
                      <span className="text-ink-muted">· {roleLabel(a.role)}</span>
                    </span>
                    {sub ? (
                      <span className="flex items-center gap-3">
                        <span className="text-ink-muted">{formatStamp(sub.uploaded_at)}</span>
                        {url ? (
                          <a href={url} className="font-semibold text-brand-strong underline underline-offset-4">
                            {sub.file_name}
                          </a>
                        ) : (
                          sub.file_name
                        )}
                      </span>
                    ) : (
                      <span className="text-ink-muted">Not yet</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
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
