import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { guidelines, SLIDES_DUE_DAYS_BEFORE } from "@/config/guidelines";
import { eventConfig as ev } from "@/config/event";
import { formatLongDay } from "@/lib/time";
import { AcknowledgeButton } from "@/components/AcknowledgeButton";

export const metadata: Metadata = { title: "Speaker guidelines" };

async function Content() {
  const me = await getMe();
  const supabase = await createClient();
  const [{ data: person }, { data: mine }] = await Promise.all([
    supabase.from("people").select("guidelines_ack_at").eq("id", me.personId).single(),
    supabase.from("assignments").select("presents, session:sessions!inner(start_time, track:tracks!inner(name))").eq("person_id", me.personId),
  ]);
  const rows = (mine ?? []) as unknown as { presents: boolean; session: { start_time: string; track: { name: string } } }[];
  const presenting = rows
    .filter((a) => a.presents)
    .map((a) => a.session.start_time)
    .sort();
  const due = presenting[0]
    ? formatLongDay(new Date(new Date(presenting[0]).getTime() - SLIDES_DUE_DAYS_BEFORE * 86400000).toISOString())
    : `${SLIDES_DUE_DAYS_BEFORE} days before your session`;

  return (
    <>
      <h1 className="font-display text-[1.9rem] font-semibold leading-tight">{guidelines.title}</h1>
      <p className="mt-2 text-ink-muted">{guidelines.intro}</p>
      <div className="mt-6 space-y-4">
        {guidelines.sections
          .filter((s) => !s.presentersOnly || presenting.length)
          .filter((s) => !("notForTracks" in s) || !rows.length || rows.some((a) => !s.notForTracks.test(a.session.track.name)))
          .map((s) => (
            <section key={s.heading} className="rounded-3xl bg-surface p-5 shadow-[0_1px_0_var(--line)]">
              <h2 className="font-display text-xl font-semibold">{s.heading}</h2>
              <div className="mt-2 space-y-2 leading-relaxed">
                {s.body.map((p) => (
                  <p key={p}>
                    {p
                      .split(/(\{slidesDue\}|\{slidesEmail\})/)
                      .map((part, i) =>
                        part === "{slidesDue}" ? (
                          <strong key={i}>{due}</strong>
                        ) : part === "{slidesEmail}" ? (
                          <a key={i} href={`mailto:${ev.slidesEmail}`} className="font-semibold text-brand-strong underline underline-offset-4">
                            {ev.slidesEmail}
                          </a>
                        ) : (
                          part
                        ),
                      )}
                  </p>
                ))}
              </div>
            </section>
          ))}
      </div>
      <div className="mt-6">
        <AcknowledgeButton label={guidelines.button} thanks={guidelines.thanks} done={!!person?.guidelines_ack_at} />
      </div>
    </>
  );
}

export default function GuidelinesPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-16 pt-4">
      <Link href="/" className="mb-3 inline-flex h-11 items-center text-[0.95rem] font-semibold text-ink-muted hover:text-ink">
        ‹ My event
      </Link>
      <Suspense fallback={<div aria-busy="true" className="h-96 animate-pulse rounded-3xl bg-surface" />}>
        <Content />
      </Suspense>
    </main>
  );
}
