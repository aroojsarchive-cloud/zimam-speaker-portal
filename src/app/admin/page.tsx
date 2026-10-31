import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireProducer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { signedUrls } from "@/lib/speaker-data";
import { roleLabel } from "@/lib/labels";
import { formatDay, formatRange } from "@/lib/time";
import { env } from "@/lib/env";
import { inviteMessage, inviteUrl } from "@/lib/invite";
import { SpeakerRow, type SpeakerView } from "@/components/SpeakerRow";
import { AddPerson } from "@/components/PersonRow";
import { LiveRefresh } from "@/components/LiveRefresh";

export const metadata: Metadata = { title: "Speakers" };

type Priv = { email: string | null; phone: string | null; invite_token: string | null; last_login_at: string | null; change_request_note: string | null };
type Person = {
  id: string;
  salutation: string | null;
  full_name: string;
  title: string | null;
  organisation: string | null;
  photo_path: string | null;
  details_status: string;
  private: Priv | Priv[] | null;
};
type Session = {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  session_type: string;
  track: { name: string; short_name: string | null; room: string | null; sort_order: number };
  assignments: { role: string; sort_order: number; presents: boolean; no_slides: boolean; slides_sent_at: string | null; person: Person }[];
};

const ROLE_ORDER = ["moderator", "chair", "co_chair", "host", "mc", "keynote", "speaker", "panelist", "jury"];
const FILTERS = [
  { key: "", label: "Everyone" },
  { key: "no-email", label: "No email" },
  { key: "not-signed-in", label: "Not signed in" },
];

async function Speakers({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  await requireProducer();
  const { show = "", q = "" } = (await searchParams) as { show?: string; q?: string };
  const { data, error } = await (await createClient())
    .from("sessions")
    .select(
      "id, title, start_time, end_time, session_type, track:tracks!inner(name, short_name, room, sort_order), assignments(role, sort_order, presents, no_slides, slides_sent_at, person:people!inner(id, salutation, full_name, title, organisation, photo_path, details_status, is_placeholder, private:people_private(email, phone, invite_token, last_login_at, change_request_note)))",
    )
    .eq("status", "published")
    .eq("session_type", "speaking")
    .order("start_time");
  if (error) throw new Error(error.message);
  const site = env.siteUrl();
  const needle = q.trim().toLowerCase();

  // One group per session, in programme order; moderators first.
  const sessions = ((data ?? []) as unknown as Session[]).sort((a, b) => a.start_time.localeCompare(b.start_time) || a.track.sort_order - b.track.sort_order);
  const everyone = new Map<string, SpeakerView>();
  const groups = sessions
    .map((s) => ({
      s,
      rows: s.assignments
        .filter((a) => !(a.person as unknown as { is_placeholder: boolean }).is_placeholder)
        .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.sort_order - b.sort_order)
        .map((a) => {
          const p = a.person;
          const priv = Array.isArray(p.private) ? p.private[0] : p.private;
          const url = priv?.email && priv.invite_token ? inviteUrl(site, priv.invite_token) : null;
          const view: SpeakerView & { _photo: string | null } = {
            id: p.id,
            salutation: p.salutation,
            full_name: p.full_name,
            title: p.title,
            organisation: p.organisation,
            photoUrl: null,
            _photo: p.photo_path,
            email: priv?.email ?? null,
            phone: priv?.phone ?? null,
            role: roleLabel(a.role),
            signedIn: !!priv?.last_login_at,
            detailsOk: p.details_status === "confirmed",
            changeNote: p.details_status === "change_requested" ? (priv?.change_request_note ?? null) : null,
            slides: a.presents ? (a.slides_sent_at ? "sent" : a.no_slides ? "none" : "waiting") : null,
            inviteUrl: url,
            inviteText: url ? inviteMessage({ salutation: p.salutation, fullName: p.full_name, url, moderator: a.role === "moderator" }) : null,
          };
          everyone.set(p.id, view);
          return view;
        })
        .filter((v) => {
          if (needle && ![v.full_name, v.organisation, v.email].some((x) => x?.toLowerCase().includes(needle))) return false;
          if (show === "no-email") return !v.email;
          if (show === "not-signed-in") return !!v.email && !v.signedIn;
          return true;
        }),
    }))
    .filter((g) => g.rows.length);

  const photos = await signedUrls("photos", [...everyone.values()].map((v) => (v as SpeakerView & { _photo: string | null })._photo));
  for (const g of groups) for (const r of g.rows) r.photoUrl = (r as SpeakerView & { _photo: string | null })._photo ? (photos.get((r as SpeakerView & { _photo: string | null })._photo!) ?? null) : null;

  const all = [...everyone.values()];
  const summary = `${all.length} speakers · ${all.filter((v) => v.email).length} can sign in · ${all.filter((v) => v.signedIn).length} signed in · ${all.filter((v) => v.detailsOk).length} details OK`;

  return (
    <>
      <p className="mt-1 text-ink-muted">{summary}</p>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin${f.key ? `?show=${f.key}` : ""}`}
            className={`flex h-9 items-center rounded-full px-4 text-sm font-semibold ${show === f.key ? "bg-ink text-white" : "border border-line bg-surface"}`}
          >
            {f.label}
          </Link>
        ))}
        <form className="ml-auto">
          {show && <input type="hidden" name="show" value={show} />}
          <input
            name="q"
            defaultValue={q}
            placeholder="Search a name or email"
            className="h-9 w-64 rounded-full border border-line bg-surface px-4 text-sm outline-none focus:border-brand-strong"
          />
        </form>
      </div>
      {groups.length ? (
        <div className="mt-6 space-y-5">
          {groups.map(({ s, rows }) => (
            <section key={s.id}>
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">
                {formatDay(s.start_time)} · {formatRange(s.start_time, s.end_time)} · {s.track.room ?? "Room TBC"} · {s.track.short_name ?? s.track.name}
              </p>
              <h2 className="mb-2 font-semibold leading-snug">{s.title}</h2>
              <ul className="overflow-hidden rounded-2xl bg-surface shadow-[0_1px_0_var(--line)]">
                {rows.map((r) => (
                  <SpeakerRow key={`${s.id}-${r.id}`} s={r} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-6 rounded-2xl bg-surface p-6 text-ink-muted">Nobody here.</p>
      )}
    </>
  );
}

export default function SpeakersPage({ searchParams }: PageProps<"/admin">) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-4xl font-semibold">Speakers</h1>
        <AddPerson />
      </div>
      <LiveRefresh />
      <Suspense fallback={<div aria-busy="true" className="mt-8 h-96 animate-pulse rounded-2xl bg-surface" />}>
        <Speakers searchParams={searchParams} />
      </Suspense>
    </>
  );
}
