import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireProducer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/speaker-data";
import { roleLabel } from "@/lib/labels";
import { formatDay, formatRange, formatTime } from "@/lib/time";
import { env } from "@/lib/env";
import { inviteMessage, inviteUrl } from "@/lib/invite";
import { AddPerson, PersonRow, type PersonView } from "@/components/PersonRow";

export const metadata: Metadata = { title: "People" };

type Priv = { email: string | null; invite_token: string | null; last_login_at: string | null; change_request_note: string | null };
type Row = {
  id: string;
  salutation: string | null;
  full_name: string;
  title: string | null;
  organisation: string | null;
  photo_path: string | null;
  details_status: string;
  private: Priv | Priv[] | null;
  assignments: {
    id: string;
    role: string;
    presents: boolean;
    sort_order: number;
    session: {
      id: string;
      title: string;
      label: string | null;
      start_time: string;
      end_time: string;
      session_type: string;
      track: { room: string | null; sort_order: number; short_name: string | null; name: string };
    } | null;
  }[];
};

const FILTERS = [
  { key: "", label: "Everyone" },
  { key: "no-email", label: "Missing email" },
  { key: "not-signed-in", label: "Never signed in" },
  { key: "unconfirmed", label: "Details not confirmed" },
  { key: "changes", label: "Change requests" },
];

async function PeopleList({ searchParams }: { searchParams: PageProps<"/admin/people">["searchParams"] }) {
  await requireProducer();
  const { filter = "", q = "" } = (await searchParams) as { filter?: string; q?: string };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("people")
    .select(
      "id, salutation, full_name, title, organisation, photo_path, details_status, private:people_private(email, invite_token, last_login_at, change_request_note), assignments(id, role, presents, sort_order, session:sessions(id, title, label, start_time, end_time, session_type, track:tracks(room, sort_order, short_name, name)))",
    )
    .eq("is_placeholder", false)
    .eq("app_role", "participant")
    .order("full_name");
  if (error) throw new Error(error.message);

  const site = env.siteUrl();
  const all: PersonView[] = ((data ?? []) as unknown as Row[]).map((r) => {
    const p = Array.isArray(r.private) ? r.private[0] : r.private;
    const url = p?.email && p.invite_token ? inviteUrl(site, p.invite_token) : null;
    return {
      id: r.id,
      salutation: r.salutation,
      full_name: r.full_name,
      title: r.title,
      organisation: r.organisation,
      photoUrl: null,
      email: p?.email ?? null,
      details_status: r.details_status,
      change_note: r.details_status === "change_requested" ? (p?.change_request_note ?? null) : null,
      last_login_at: p?.last_login_at ?? null,
      sessions: r.assignments
        .filter((a) => a.session)
        .sort((a, b) => a.session!.start_time.localeCompare(b.session!.start_time))
        .map((a) => ({
          assignmentId: a.id,
          title: a.session!.title,
          role: roleLabel(a.role),
          time: `${formatDay(a.session!.start_time)} ${formatTime(a.session!.start_time)}`,
          presents: a.presents,
          speaking: a.session!.session_type === "speaking",
        })),
      inviteUrl: url,
      inviteText: url ? inviteMessage({ salutation: r.salutation, fullName: r.full_name, url }) : null,
      _photo: r.photo_path,
      _assignments: r.assignments.filter((a) => a.session),
    } as PersonView & { _photo: string | null; _assignments: Row["assignments"] };
  });

  const needle = q.trim().toLowerCase();
  const shown = all.filter((p) => {
    if (needle && ![p.full_name, p.organisation, p.email].some((v) => v?.toLowerCase().includes(needle))) return false;
    if (filter === "no-email") return !p.email;
    if (filter === "not-signed-in") return !p.last_login_at;
    if (filter === "unconfirmed") return p.details_status !== "confirmed";
    if (filter === "changes") return p.details_status === "change_requested";
    return true;
  });
  const photos = await signedUrls("photos", shown.map((p) => (p as PersonView & { _photo: string | null })._photo));
  for (const p of shown) {
    const path = (p as PersonView & { _photo: string | null })._photo;
    p.photoUrl = path ? (photos.get(path) ?? null) : null;
  }

  // Programme order: one group per session (moderator first), then anyone not on a session yet.
  const ROLE_ORDER = ["moderator", "chair", "co_chair", "host", "mc", "keynote", "speaker", "panelist", "jury"];
  type Ext = PersonView & { _assignments: Row["assignments"] };
  const groupMap = new Map<string, { start: string; order: number; title: string; sub: string; items: { k: number; o: number; p: PersonView }[] }>();
  const unassigned: PersonView[] = [];
  for (const p of shown as Ext[]) {
    if (!p._assignments.length) unassigned.push(p);
    for (const a of p._assignments) {
      const s = a.session!;
      const g = groupMap.get(s.id) ?? {
        start: s.start_time,
        order: s.track.sort_order,
        title: s.title,
        sub: `${formatDay(s.start_time)} · ${formatRange(s.start_time, s.end_time)} · ${s.track.room ?? "Room TBC"} · ${s.label ?? s.track.short_name ?? s.track.name}`,
        items: [],
      };
      g.items.push({ k: ROLE_ORDER.indexOf(a.role), o: a.sort_order, p });
      groupMap.set(s.id, g);
    }
  }
  const groups = [...groupMap.entries()]
    .sort(([, x], [, y]) => x.start.localeCompare(y.start) || x.order - y.order)
    .map(([key, g]) => ({ key, title: g.title, sub: g.sub, people: g.items.sort((x, y) => x.k - y.k || x.o - y.o).map((x) => x.p) }));
  if (unassigned.length) groups.push({ key: "none", title: "Not on a session yet", sub: "Unassigned", people: unassigned });

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/people${f.key ? `?filter=${f.key}` : ""}`}
            className={`flex h-9 items-center rounded-full px-4 text-sm font-semibold ${
              filter === f.key ? "bg-ink text-white" : "border border-line bg-surface"
            }`}
          >
            {f.label}
          </Link>
        ))}
        <form className="ml-auto">
          {filter && <input type="hidden" name="filter" value={filter} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, organisation, email"
            className="h-9 w-72 rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-brand-strong"
          />
        </form>
      </div>
      <p className="mt-4 text-sm text-ink-muted">
        {shown.length} of {all.length} people
      </p>
      {shown.length ? (
        <div className="mt-2 space-y-5">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.title}>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">{g.sub}</p>
              <h2 className="mb-2 font-semibold">{g.title}</h2>
              <ul className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_0_var(--line)]">
                {g.people.map((p) => (
                  <PersonRow key={`${g.key}-${p.id}`} p={p} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-6 rounded-2xl bg-surface p-6 text-ink-muted">Nobody matches. Nice work if that&apos;s a to-do list.</p>
      )}
    </>
  );
}

export default function PeoplePage({ searchParams }: PageProps<"/admin/people">) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold">People</h1>
          <p className="mt-1 max-w-2xl text-ink-muted">
            A speaker&apos;s email is their username. Add it, then send their personal invite by WhatsApp or email.
          </p>
        </div>
        <AddPerson />
      </div>
      <Suspense fallback={<div aria-busy="true" className="mt-8 h-96 animate-pulse rounded-2xl bg-surface" />}>
        <PeopleList searchParams={searchParams} />
      </Suspense>
    </>
  );
}
