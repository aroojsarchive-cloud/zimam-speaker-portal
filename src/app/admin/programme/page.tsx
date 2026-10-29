import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireProducer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/labels";
import { formatDay, formatTime } from "@/lib/time";
import { ProgrammeEditor, type EditorTrack, type PersonOption } from "@/components/ProgrammeEditor";

export const metadata: Metadata = { title: "Programme" };

type Row = {
  id: string;
  date: string;
  label: string;
  tracks: {
    id: string;
    name: string;
    short_name: string | null;
    room: string | null;
    strapline: string | null;
    sort_order: number;
    sessions: {
      id: string;
      start_time: string;
      end_time: string;
      sequence: number;
      label: string | null;
      title: string;
      format: string;
      session_type: "speaking" | "non_speaking";
      status: "draft" | "published";
      description: string | null;
      assignments: {
        id: string;
        role: string;
        status: string;
        presents: boolean;
        sort_order: number;
        person: { salutation: string | null; full_name: string; is_placeholder: boolean };
      }[];
    }[];
  }[];
};

const ROLE_ORDER = ["moderator", "chair", "co_chair", "host", "mc", "keynote", "speaker", "panelist", "jury"];

async function Editor({ searchParams }: { searchParams: PageProps<"/admin/programme">["searchParams"] }) {
  const me = await requireProducer();
  const { day: dayParam, tab: tabParam } = (await searchParams) as { day?: string; tab?: string };
  const supabase = await createClient();
  const [{ data, error }, { data: ppl }] = await Promise.all([
    supabase
      .from("days")
      .select(
        "id, date, label, tracks(id, name, short_name, room, strapline, sort_order, sessions(id, start_time, end_time, sequence, label, title, format, session_type, status, description, assignments(id, role, status, presents, sort_order, person:people!inner(salutation, full_name, is_placeholder))))",
      )
      .eq("event_id", me.eventId)
      .order("date"),
    supabase
      .from("people")
      .select("id, salutation, full_name, organisation")
      .eq("is_placeholder", false)
      .eq("app_role", "participant")
      .order("full_name"),
  ]);
  if (error) throw new Error(error.message);
  const days = (data ?? []) as unknown as Row[];
  if (!days.length) return <p className="mt-6 text-ink-muted">No programme yet.</p>;
  // Busy days (Day 1) get one tab per programme, like the speaker agenda.
  // One-off tracks (MoU signing, awards) ride along with the first programme.
  const tabs = days.flatMap((d, k) => {
    const sorted = [...d.tracks].sort((a, b) => a.sort_order - b.sort_order);
    const programmes = sorted.filter((t) => t.sessions.length > 1);
    if (programmes.length < 2) return [{ key: d.date, label: `Day ${k + 1} · ${formatDay(`${d.date}T08:00:00Z`)}`, day: d, tracks: sorted }];
    const singles = sorted.filter((t) => t.sessions.length <= 1);
    return programmes.map((t, i) => ({
      key: t.id,
      label: `Day ${k + 1} · ${t.short_name ?? t.name}`,
      day: d,
      tracks: i === 0 ? [t, ...singles] : [t],
    }));
  });
  const tab = tabs.find((t) => t.key === tabParam) ?? tabs.find((t) => t.day.date === dayParam) ?? tabs[0];
  const day = tab.day;

  const tracks: EditorTrack[] = tab.tracks
    .map((t) => {
      const sessions = [...t.sessions].sort((a, b) => a.start_time.localeCompare(b.start_time) || a.sequence - b.sequence);
      return {
        id: t.id,
        name: t.name,
        short_name: t.short_name ?? "",
        room: t.room ?? "",
        strapline: t.strapline ?? "",
        sessions: sessions.map((s, i) => {
          const prev = sessions[i - 1];
          const warning = prev
            ? s.start_time < prev.end_time
              ? `Overlaps “${prev.title}” (ends ${formatTime(prev.end_time)})`
              : s.start_time > prev.end_time
                ? `${Math.round((new Date(s.start_time).getTime() - new Date(prev.end_time).getTime()) / 60000)}-minute gap before this`
                : null
            : null;
          return {
            id: s.id,
            start: formatTime(s.start_time),
            end: formatTime(s.end_time),
            label: s.label ?? "",
            title: s.title,
            format: s.format,
            session_type: s.session_type,
            status: s.status,
            description: s.description ?? "",
            warning,
            assignments: [...s.assignments]
              .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.sort_order - b.sort_order)
              .map((a) => ({
                id: a.id,
                role: a.role,
                status: a.status,
                presents: a.presents,
                person: { name: a.person.is_placeholder ? a.person.full_name : displayName(a.person), placeholder: a.person.is_placeholder },
              })),
          };
        }),
      };
    });
  const people: PersonOption[] = (ppl ?? []).map((p) => ({
    id: p.id,
    label: `${displayName(p)}${p.organisation ? `, ${p.organisation}` : ""}`,
  }));

  return (
    <>
      <nav aria-label="Programme sections" className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/admin/programme?tab=${t.key}`}
            aria-current={t.key === tab.key ? "page" : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${t.key === tab.key ? "bg-ink text-white" : "border border-line bg-surface"}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="mt-6">
        <ProgrammeEditor key={tab.key} tracks={tracks} date={day.date} people={people} />
      </div>
    </>
  );
}

export default function ProgrammePage({ searchParams }: PageProps<"/admin/programme">) {
  return (
    <>
      <h1 className="font-display text-4xl font-semibold">Programme</h1>
      <p className="mt-1 max-w-3xl text-ink-muted">
        Change times, rooms, titles and who&apos;s on each session. Saved changes appear on speakers&apos; phones straight away and are
        recorded. Times are Dubai time; the running order follows start times. ▣ = presenting slides.
      </p>
      <Suspense fallback={<div aria-busy="true" className="mt-8 h-96 animate-pulse rounded-2xl bg-surface" />}>
        <Editor searchParams={searchParams} />
      </Suspense>
    </>
  );
}
