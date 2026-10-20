import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { eventConfig as ev } from "@/config/event";
import { requireProducer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { displayName, formatLabel, roleLabel } from "@/lib/labels";
import { formatLongDay, formatRange, formatStamp } from "@/lib/time";
import { PrintButton } from "@/components/PrintButton";

export const metadata: Metadata = { title: "Print" };

type Session = {
  id: string;
  start_time: string;
  end_time: string;
  label: string | null;
  title: string;
  format: string;
  session_type: string;
  status: string;
  assignments: {
    role: string;
    presents: boolean;
    sort_order: number;
    person: { salutation: string | null; full_name: string; organisation: string | null; is_placeholder: boolean };
  }[];
};
type Day = {
  id: string;
  date: string;
  label: string;
  tracks: { id: string; name: string; room: string | null; strapline: string | null; sort_order: number; sessions: Session[] }[];
};

const ROLE_ORDER = ["moderator", "chair", "co_chair", "host", "mc", "keynote", "speaker", "panelist", "jury"];
const people = (s: Session) =>
  [...s.assignments].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.sort_order - b.sort_order);
const nameOf = (a: Session["assignments"][number]) => (a.person.is_placeholder ? a.person.full_name : displayName(a.person));

function Header({ title, sub, stamp }: { title: string; sub: string; stamp: string }) {
  return (
    <header className="mb-4 flex items-end justify-between gap-4 border-b-2 border-brand pb-2">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ev.logo.wordmark} alt={ev.logo.alt} className="mb-2 h-7 w-auto" />
        <h2 className="text-xl font-bold leading-tight">{title}</h2>
        <p className="text-sm">{sub}</p>
      </div>
      <p className="text-right text-xs text-ink-muted">
        {ev.name}
        <br />
        Printed from live data {stamp} ({ev.timezoneLabel})
      </p>
    </header>
  );
}

async function Printable({ searchParams }: { searchParams: PageProps<"/admin/print">["searchParams"] }) {
  const me = await requireProducer();
  const { view = "agenda" } = (await searchParams) as { view?: string };
  const { data, error } = await (await createClient())
    .from("days")
    .select(
      "id, date, label, tracks(id, name, room, strapline, sort_order, sessions(id, start_time, end_time, label, title, format, session_type, status, assignments(role, presents, sort_order, person:people!inner(salutation, full_name, organisation, is_placeholder))))",
    )
    .eq("event_id", me.eventId)
    .order("date");
  if (error) throw new Error(error.message);
  const stamp = formatStamp(new Date().toISOString());
  const days = ((data ?? []) as unknown as Day[]).map((d) => ({
    ...d,
    tracks: [...d.tracks]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((t) => ({ ...t, sessions: t.sessions.filter((s) => s.status === "published").sort((a, b) => a.start_time.localeCompare(b.start_time)) }))
      .filter((t) => t.sessions.length),
  }));

  const views = [
    { key: "agenda", label: "Full agenda" },
    { key: "rooms", label: "Room running orders" },
  ];

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center gap-3 print:hidden">
        {views.map((v) => (
          <Link
            key={v.key}
            href={`/admin/print?view=${v.key}`}
            className={`flex h-11 items-center rounded-xl px-4 font-semibold ${view === v.key ? "bg-ink text-white" : "border border-line bg-surface"}`}
          >
            {v.label}
          </Link>
        ))}
        <span className="ml-auto">
          <PrintButton />
        </span>
        <p className="w-full text-sm text-ink-muted">
          In the print window choose &ldquo;Save as PDF&rdquo; to keep a copy on your phone or send it by WhatsApp. Drafts are left out.
        </p>
      </div>

      <div className="print-sheet bg-white text-[11pt] leading-snug text-black">
        {view === "rooms"
          ? days.flatMap((d) =>
              d.tracks.map((t) => (
                <section key={t.id} className="print-page mb-10">
                  <Header title={`${t.room ?? "Room TBC"} · ${t.name}`} sub={`Running order · ${formatLongDay(`${d.date}T08:00:00Z`)}`} stamp={stamp} />
                  <table className="w-full border-collapse text-[10pt]">
                    <thead>
                      <tr className="border-b border-black text-left">
                        <th className="w-24 py-1 pr-2">Time</th>
                        <th className="py-1 pr-2">Session</th>
                        <th className="w-[38%] py-1 pr-2">On stage</th>
                        <th className="w-10 py-1 text-center">In</th>
                      </tr>
                    </thead>
                    <tbody>
                      {t.sessions.map((s) => {
                        const ppl = people(s);
                        const isBreak = s.session_type === "non_speaking";
                        return (
                          <tr key={s.id} className={`break-inside-avoid border-b border-black/20 align-top ${isBreak ? "bg-black/5" : ""}`}>
                            <td className="py-1.5 pr-2 font-bold tabular-nums">{formatRange(s.start_time, s.end_time)}</td>
                            <td className="py-1.5 pr-2">
                              {!isBreak && <span className="block text-[8.5pt] font-bold uppercase text-brand-strong">{s.label ?? formatLabel(s.format)}</span>}
                              <span className={isBreak ? "italic" : "font-semibold"}>{s.title}</span>
                            </td>
                            <td className="py-1.5 pr-2">
                              {ppl.map((a, k) => (
                                <span key={k} className={`block ${a.person.is_placeholder ? "italic text-black/60" : ""}`}>
                                  {nameOf(a)}
                                  {a.role !== "panelist" && a.role !== "speaker" ? ` (${roleLabel(a.role)})` : ""}
                                  {a.presents ? " ▣ slides" : ""}
                                </span>
                              ))}
                            </td>
                            <td className="py-1.5 text-center">
                              {ppl.filter((a) => !a.person.is_placeholder).map((_, k) => (
                                <span key={k} className="mx-auto mb-1 block h-3.5 w-3.5 border border-black" />
                              ))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
              )),
            )
          : days.map((d, k) => (
              <section key={d.id} className="print-page mb-10">
                <Header title={`Day ${k + 1} · ${d.label}`} sub={formatLongDay(`${d.date}T08:00:00Z`)} stamp={stamp} />
                {d.tracks.map((t) => (
                  <div key={t.id} className="mb-5">
                    <h3 className="mb-1 border-b border-black/40 pb-0.5 text-[12pt] font-bold">
                      {t.name} <span className="font-normal">· {t.room ?? "Room TBC"}</span>
                    </h3>
                    <table className="w-full border-collapse text-[9.5pt]">
                      <tbody>
                        {t.sessions.map((s) => (
                          <tr key={s.id} className="break-inside-avoid border-b border-black/10 align-top">
                            <td className="w-24 py-1 pr-2 font-bold tabular-nums">{formatRange(s.start_time, s.end_time)}</td>
                            <td className="py-1 pr-2">
                              <span className={s.session_type === "non_speaking" ? "italic" : "font-semibold"}>{s.title}</span>
                              {s.session_type === "speaking" && s.assignments.length > 0 && (
                                <span className="block text-black/75">
                                  {people(s)
                                    .map((a) => `${nameOf(a)}${a.role === "moderator" ? " (Moderator)" : ""}${!a.person.is_placeholder && a.person.organisation ? `, ${a.person.organisation}` : ""}`)
                                    .join(" · ")}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </section>
            ))}
      </div>
    </>
  );
}

export default function PrintPage({ searchParams }: PageProps<"/admin/print">) {
  return (
    <>
      <h1 className="mb-4 font-display text-4xl font-semibold print:hidden">Print</h1>
      <Suspense fallback={<div aria-busy="true" className="h-96 animate-pulse rounded-2xl bg-surface" />}>
        <Printable searchParams={searchParams} />
      </Suspense>
    </>
  );
}
