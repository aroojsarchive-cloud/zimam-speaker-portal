import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { eventConfig as ev } from "@/config/event";
import { requireProducer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/speaker-data";
import { displayName, roleLabel } from "@/lib/labels";
import { needsSlides, prepSteps, type PrepEngagement } from "@/lib/prep";
import { ProgressTable, type ProgressGroup, type ProgressRow } from "@/components/ProgressTable";
import { formatDay, formatRange } from "@/lib/time";
import { LiveRefresh } from "@/components/LiveRefresh";

export const metadata: Metadata = { title: "Producer" };

type Priv = { email: string | null; last_login_at: string | null };
type Row = {
  id: string;
  salutation: string | null;
  full_name: string;
  organisation: string | null;
  photo_path: string | null;
  details_status: string;
  guidelines_ack_at: string | null;
  private: Priv | Priv[] | null;
  assignments: {
    id: string;
    role: string;
    sort_order: number;
    reviewed_at: string | null;
    no_slides: boolean;
    presents: boolean;
    slides_sent_at: string | null;
    checked_in_at: string | null;
    session: {
      id: string;
      title: string;
      start_time: string;
      session_type: string;
      end_time: string;
      label: string | null;
      track: { room: string | null; sort_order: number; short_name: string | null; name: string };
      notes: { kind: string }[];
    } | null;
  }[];
};

const VIEWS = [
  { key: "", label: "By session" },
  { key: "least", label: "Least prepared first" },
  { key: "stuck", label: "Not finished" },
  { key: "not-opened", label: "Haven't opened link" },
  { key: "moderators", label: "Moderators" },
];

async function Tracker({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  await requireProducer();
  const { view = "" } = (await searchParams) as { view?: string };
  const supabase = await createClient();
  const [{ data, error }] = await Promise.all([
    supabase
      .from("people")
      .select(
        "id, salutation, full_name, organisation, photo_path, details_status, guidelines_ack_at, private:people_private(email, last_login_at), assignments(id, role, sort_order, reviewed_at, no_slides, presents, slides_sent_at, checked_in_at, session:sessions(id, title, label, start_time, end_time, session_type, track:tracks(room, sort_order, short_name, name), notes:concept_notes(kind)))",
      )
      .eq("is_placeholder", false)
      .eq("app_role", "participant"),
  ]);
  if (error) throw new Error(error.message);

  const all = ((data ?? []) as unknown as Row[])
    .filter((r) => r.assignments.some((a) => a.session))
    .map((r) => {
      const priv = Array.isArray(r.private) ? r.private[0] : r.private;
      const prep: PrepEngagement[] = r.assignments
        .filter((a) => a.session)
        .map((a) => ({
          assignmentId: a.id,
          role: a.role,
          sessionId: a.session!.id,
          sessionTitle: a.session!.title,
          speaking: a.session!.session_type === "speaking",
          start: a.session!.start_time,
          room: a.session!.track.room,
          reviewedAt: a.reviewed_at,
          noSlides: a.no_slides,
          hasSlides: !!a.slides_sent_at,
          presents: a.presents,
          briefPublished: a.session!.notes.some((n) => n.kind === "published"),
          checkedInAt: a.checked_in_at,
        }));
      const slideables = prep.filter(needsSlides);
      const onlyNoSlides = slideables.length > 0 && slideables.every((p) => !p.hasSlides && p.noSlides);
      return {
        row: {
          id: r.id,
          name: displayName(r),
          org: r.organisation,
          photoUrl: null as string | null,
          email: priv?.email ?? null,
          lastLogin: priv?.last_login_at ?? null,
          roles: [...new Set(prep.map((p) => roleLabel(p.role)))].join(", "),
          steps: prepSteps({ detailsConfirmed: r.details_status === "confirmed", guidelinesAck: !!r.guidelines_ack_at, engagements: prep }),
          slidesNote: onlyNoSlides ? "None" : null,
        } satisfies ProgressRow,
        photo: r.photo_path,
        moderator: prep.some((p) => p.role === "moderator"),
        assignments: r.assignments.filter((a) => a.session),
      };
    });

  const shown = all
    .filter(({ row, moderator }) => {
      if (view === "stuck") return row.steps.some((s) => !s.done);
      if (view === "not-opened") return !row.lastLogin;
      if (view === "moderators") return moderator;
      return true;
    })
    .sort((a, b) => a.row.steps.filter((s) => s.done).length / a.row.steps.length - b.row.steps.filter((s) => s.done).length / b.row.steps.length || a.row.name.localeCompare(b.row.name));

  const photos = await signedUrls("photos", shown.map((s) => s.photo));
  for (const s of shown) s.row.photoUrl = s.photo ? (photos.get(s.photo) ?? null) : null;

  // Default: programme order, one group per session, moderator first within each.
  const ROLE_ORDER = ["moderator", "chair", "co_chair", "host", "mc", "keynote", "speaker", "panelist", "jury"];
  let groups: ProgressGroup[];
  if (view === "least") {
    groups = [{ key: "all", title: "", sub: "", rows: shown.map((s) => s.row) }];
  } else {
    const bySession = new Map<string, { start: string; order: number; group: ProgressGroup; sortable: { k: number; o: number; row: ProgressGroup["rows"][number] }[] }>();
    for (const p of shown)
      for (const a of p.assignments) {
        const s = a.session!;
        const g =
          bySession.get(s.id) ??
          {
            start: s.start_time,
            order: s.track.sort_order,
            group: {
              key: s.id,
              title: s.title,
              sub: `${formatDay(s.start_time)} · ${formatRange(s.start_time, s.end_time)} · ${s.track.room ?? "Room TBC"} · ${s.label ?? s.track.short_name ?? s.track.name}`,
              rows: [],
            },
            sortable: [],
          };
        g.sortable.push({ k: ROLE_ORDER.indexOf(a.role), o: a.sort_order, row: { ...p.row, roleHere: roleLabel(a.role) } });
        bySession.set(s.id, g);
      }
    groups = [...bySession.values()]
      .sort((x, y) => x.start.localeCompare(y.start) || x.order - y.order)
      .map((g) => ({ ...g.group, rows: g.sortable.sort((x, y) => x.k - y.k || x.o - y.o).map((x) => x.row) }));
  }

  const rows = all.map((a) => a.row);
  const count = (key: string) => rows.filter((r) => r.steps.find((s) => s.key === key)?.done).length;
  const has = (key: string) => rows.filter((r) => r.steps.some((s) => s.key === key)).length;
  const stats = [
    { label: "Speakers", value: `${rows.length}` },
    { label: "Opened their link", value: `${rows.filter((r) => r.lastLogin).length} / ${rows.filter((r) => r.email).length}` },
    { label: "Details confirmed", value: `${count("details")} / ${rows.length}` },
    { label: "Guidelines read", value: `${count("guidelines")} / ${has("guidelines")}` },
    { label: "Session checked", value: `${count("session")} / ${has("session")}` },
    { label: "Slides sorted", value: `${count("slides")} / ${has("slides")}` },
    { label: "Briefs published", value: `${count("brief")} / ${has("brief")}` },
    { label: "Missing email", value: `${rows.filter((r) => !r.email).length}`, warn: rows.some((r) => !r.email) },
    { label: "All steps done", value: `${rows.filter((r) => r.steps.every((s) => s.done)).length}` },
  ];

  return (
    <>
      <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-surface p-5 shadow-[0_1px_0_var(--line)]">
            <dt className="text-sm text-ink-muted">{s.label}</dt>
            <dd className={`mt-1 font-display text-3xl font-semibold tabular-nums ${s.warn ? "text-warning" : ""}`}>{s.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold">Speaker progress</h2>
        <div className="flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={`/admin${v.key ? `?view=${v.key}` : ""}`}
              className={`flex h-9 items-center rounded-full px-4 text-sm font-semibold ${
                view === v.key ? "bg-ink text-white" : "border border-line bg-surface"
              }`}
            >
              {v.label}
            </Link>
          ))}
        </div>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Steps: check details · read guidelines · check session · slides (or &ldquo;no slides&rdquo;) · brief (moderators) · in
        the room 20 min before. Send reminders from People.
      </p>
      <div className="mt-4">
        {shown.length ? (
          <ProgressTable groups={groups} />
        ) : (
          <p className="rounded-2xl bg-surface p-6 text-ink-muted">Nobody here.</p>
        )}
      </div>
    </>
  );
}

export default function AdminHome({ searchParams }: PageProps<"/admin">) {
  return (
    <>
      <h1 className="font-display text-4xl font-semibold">{ev.name}</h1>
      <p className="mt-1 text-ink-muted">
        {ev.dates} · {ev.venue}
      </p>
      <LiveRefresh />
      <Suspense
        fallback={
          <div aria-busy="true" className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface shadow-[0_1px_0_var(--line)]" />
            ))}
          </div>
        }
      >
        <Tracker searchParams={searchParams} />
      </Suspense>
    </>
  );
}
