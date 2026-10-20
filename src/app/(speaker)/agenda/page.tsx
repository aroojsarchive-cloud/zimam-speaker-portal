import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { eventConfig as ev } from "@/config/event";
import { getMe } from "@/lib/me";
import {
  getAgenda,
  getMyEngagements,
  signedUrls,
  type AgendaDay,
} from "@/lib/speaker-data";
import { displayName, formatLabel, roleLabel } from "@/lib/labels";
import { Avatar } from "@/components/Avatar";
import { formatLongDay, formatRange } from "@/lib/time";

export const metadata: Metadata = { title: "Agenda" };

type Search = PageProps<"/agenda">["searchParams"];
type Track = AgendaDay["tracks"][number];

const ROLE_ORDER = [
  "moderator",
  "chair",
  "co_chair",
  "host",
  "mc",
  "keynote",
  "speaker",
  "panelist",
  "jury",
];

type Row = Track["sessions"][number] & { track: Track };

function Speakers({
  people,
  photos,
}: {
  people: Row["assignments"];
  photos: Map<string, string>;
}) {
  const named = people
    .filter((a) => !a.person.is_placeholder)
    .sort(
      (a, b) =>
        ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
        a.sort_order - b.sort_order,
    );
  const tbc = people.length - named.length;
  if (!named.length && !tbc) return null;
  return (
    <ul className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {named.map((a, k) => (
        <li
          key={`${a.person_id}-${a.role}-${k}`}
          className="flex items-center gap-4"
        >
          <span className="shrink-0 rounded-full ring-[3px] ring-brand ring-offset-2 ring-offset-surface">
            <Avatar
              name={a.person.full_name}
              src={a.person.photo_path ? photos.get(a.person.photo_path) : null}
              size="agenda"
            />
          </span>
          <div className="min-w-0 leading-snug">
            <p className="text-[0.9rem] font-bold uppercase tracking-[0.03em] text-brand-strong">
              {displayName(a.person)}
            </p>
            {!["panelist", "speaker"].includes(a.role) && (
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">
                {roleLabel(a.role)}
              </p>
            )}
            {a.person.title && (
              <p className="mt-0.5 text-sm">{a.person.title}</p>
            )}
            {a.person.organisation && (
              <p className="text-sm font-semibold">{a.person.organisation}</p>
            )}
          </div>
        </li>
      ))}
      {tbc > 0 && (
        <li className="flex items-center gap-4 text-ink-muted">
          <span className="shrink-0 rounded-full ring-[3px] ring-line ring-offset-2 ring-offset-surface">
            <Avatar name="TBC" placeholder size="agenda" />
          </span>
          <p className="text-sm font-semibold uppercase tracking-[0.03em]">
            {tbc === 1
              ? named.length
                ? "1 more speaker TBC"
                : "Speaker TBC"
              : `${tbc} speakers TBC`}
          </p>
        </li>
      )}
    </ul>
  );
}

/** The programme as a running list: time · room · session with its speakers. */
function AgendaRows({
  rows,
  mine,
  photos,
}: {
  rows: Row[];
  mine: Set<string>;
  photos: Map<string, string>;
}) {
  return (
    <ol className="rounded-3xl bg-surface px-5 shadow-[0_1px_0_var(--line)] md:px-8">
      {rows.map((s, k) => {
        const isMine = mine.has(s.id);
        const isBreak =
          s.session_type === "non_speaking" && s.format === "break";
        const newBlock =
          s.block_label && s.block_label !== rows[k - 1]?.block_label;
        return (
          <li key={s.id}>
            {newBlock && (
              <p
                className={`pt-6 text-xs font-bold uppercase tracking-[0.14em] text-ink-muted ${k ? "border-t border-dotted border-ink/30" : ""}`}
              >
                {s.block_label}
              </p>
            )}
            <div
              className={`grid gap-x-6 gap-y-1 py-6 md:grid-cols-[9.5rem_8.5rem_1fr] ${
                k < rows.length - 1
                  ? "border-b border-dotted border-ink/30"
                  : ""
              } ${isMine ? "-mx-5 bg-brand-soft px-5 md:-mx-8 md:px-8" : ""}`}
            >
              <div className="flex items-baseline gap-3 md:contents">
                <p className="font-display text-[1.3rem] tabular-nums md:text-[1.35rem]">
                  {formatRange(s.start_time, s.end_time)}
                </p>
                <p className="text-ink-muted md:text-[1.15rem] md:text-ink">
                  {s.track.room ?? "Room TBC"}
                </p>
              </div>
              <div className="min-w-0">
                {!isBreak && (
                  <p className="text-sm font-bold uppercase tracking-[0.06em] text-brand-strong">
                    {s.label ?? formatLabel(s.format)}
                  </p>
                )}
                {isBreak ? (
                  <p className="text-[1.2rem] font-bold leading-snug text-ink-muted">
                    {s.title}
                  </p>
                ) : (
                  <Link
                    href={`/sessions/${s.id}`}
                    className="block text-[1.25rem] font-bold leading-snug hover:underline md:text-[1.35rem]"
                  >
                    {s.title}
                  </Link>
                )}
                {isMine && (
                  <span className="mt-2 inline-block rounded-full bg-brand-strong px-3 py-1 text-xs font-bold text-white">
                    You&apos;re on
                  </span>
                )}
                {s.session_type === "speaking" && (
                  <Speakers people={s.assignments} photos={photos} />
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

type Day = AgendaDay;
type Tab = {
  key: string;
  label: string;
  sub: string;
  day: Day;
  track: Track | null;
};

/**
 * Tabs: "At a glance" first, then one tab per programme on days with parallel
 * programmes (Opening & Plenary, Health AI Summit, HIE Summit), then one tab per
 * remaining day (Day 2, Day 3).
 */
function buildTabs(days: Day[]): Tab[] {
  const tabs: Tab[] = [];
  days.forEach((d, k) => {
    const programmes = d.tracks.filter((t) => t.sessions.length > 1);
    if (programmes.length >= 2) {
      for (const t of programmes)
        tabs.push({
          key: t.id,
          label: t.short_name ?? t.name,
          sub: `Day ${k + 1} · ${t.room ?? "Room TBC"}`,
          day: d,
          track: t,
        });
    } else {
      tabs.push({
        key: `day-${d.date}`,
        label: `Day ${k + 1}`,
        sub: d.label,
        day: d,
        track: null,
      });
    }
  });
  return tabs;
}

const span = (t: Track) => ({
  start: t.sessions.reduce(
    (m, s) => (s.start_time < m ? s.start_time : m),
    t.sessions[0].start_time,
  ),
  end: t.sessions.reduce(
    (m, s) => (s.end_time > m ? s.end_time : m),
    t.sessions[0].end_time,
  ),
});

function TabBar({ tabs, active }: { tabs: Tab[]; active: string }) {
  const all = [
    { key: "glance", label: "At a glance", sub: "All days" },
    ...tabs,
  ];
  return (
    <nav aria-label="Agenda" className="-mx-4 overflow-x-auto px-4 pb-1">
      <div className="flex w-max gap-2">
        {all.map((t) => {
          const on = t.key === active;
          return (
            <Link
              key={t.key}
              href={`/agenda?tab=${t.key}`}
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={`rounded-2xl px-4 py-2 text-left transition ${
                on
                  ? "bg-ink text-white"
                  : "bg-surface shadow-[0_1px_0_var(--line)] hover:bg-line/40"
              }`}
            >
              <span className="block whitespace-nowrap font-display text-[1.05rem] font-semibold leading-tight">
                {t.label}
              </span>
              <span
                className={`block whitespace-nowrap text-xs ${on ? "text-white/75" : "text-ink-muted"}`}
              >
                {t.sub}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** One screen, the whole forum: what's on, where, and in parallel with what. */
function Glance({
  days,
  tabs,
  mine,
}: {
  days: Day[];
  tabs: Tab[];
  mine: Set<string>;
}) {
  const tabFor = (d: Day, t: Track) =>
    tabs.find((x) => x.track?.id === t.id) ??
    tabs.find((x) => x.day.id === d.id && !x.track);
  return (
    <div className="space-y-8">
      {days.map((d, k) => {
        // Programmes that start together run in parallel: show them side by side.
        const blocks = new Map<string, Track[]>();
        for (const t of [...d.tracks].sort(
          (a, b) =>
            span(a).start.localeCompare(span(b).start) ||
            a.sort_order - b.sort_order,
        )) {
          const key = span(t).start;
          blocks.set(key, [...(blocks.get(key) ?? []), t]);
        }
        return (
          <section key={d.id} aria-labelledby={`day-${d.id}`}>
            <h2
              id={`day-${d.id}`}
              className="font-display text-2xl font-semibold"
            >
              Day {k + 1} · {d.label}
            </h2>
            <p className="text-sm text-ink-muted">
              {formatLongDay(`${d.date}T08:00:00Z`)}
            </p>
            <ol className="mt-3 space-y-3">
              {[...blocks.values()].map((group) => {
                const start = group.map((t) => span(t).start).sort()[0];
                const end = group
                  .map((t) => span(t).end)
                  .sort()
                  .at(-1)!;
                return (
                  <li
                    key={start}
                    className="grid gap-2 sm:grid-cols-[7.5rem_1fr] sm:gap-4"
                  >
                    <p className="pt-1 font-display text-lg font-semibold tabular-nums">
                      {formatRange(start, end)}
                    </p>
                    <div
                      className={`grid gap-2 ${group.length > 1 ? "grid-cols-2" : ""}`}
                    >
                      {group.map((t) => {
                        const tab = tabFor(d, t);
                        const myHere = t.sessions.filter((s) => mine.has(s.id));
                        const body = (
                          <>
                            <span
                              aria-hidden
                              className="block h-1.5"
                              style={{
                                background: t.colour ?? ev.colours.brand,
                              }}
                            />
                            <span className="block p-3.5">
                              <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-ink-muted">
                                {t.room ?? "Room TBC"}
                              </span>
                              <span className="mt-0.5 block font-semibold leading-snug">
                                {t.name}
                              </span>
                              {t.strapline && t.strapline !== "TBC" && (
                                <span className="mt-1 line-clamp-2 block text-sm leading-snug text-ink-muted">
                                  {t.strapline}
                                </span>
                              )}
                              {group.length > 1 && (
                                <span className="mt-1 block text-xs text-ink-muted tabular-nums">
                                  {formatRange(span(t).start, span(t).end)}
                                </span>
                              )}
                              {myHere.length > 0 && (
                                <span className="mt-2 inline-block rounded-full bg-brand-strong px-2.5 py-0.5 text-xs font-bold text-white">
                                  You&apos;re on{" "}
                                  {myHere
                                    .map((s) =>
                                      formatRange(s.start_time, s.end_time),
                                    )
                                    .join(", ")}
                                </span>
                              )}
                            </span>
                          </>
                        );
                        const cls = `block overflow-hidden rounded-2xl transition ${
                          myHere.length
                            ? "bg-brand-soft ring-2 ring-brand"
                            : "bg-surface shadow-[0_1px_0_var(--line)]"
                        }`;
                        return tab ? (
                          <Link
                            key={t.id}
                            href={`/agenda?tab=${tab.key}`}
                            className={`${cls} hover:shadow-md`}
                          >
                            {body}
                          </Link>
                        ) : (
                          <div key={t.id} className={cls}>
                            {body}
                          </div>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

async function AgendaContent({ searchParams }: { searchParams: Search }) {
  const me = await getMe();
  const [{ tab: tabParam = "glance" }, days, mineList] = await Promise.all([
    searchParams as Promise<{ tab?: string }>,
    getAgenda(me.eventId),
    getMyEngagements(me.personId),
  ]);
  if (!days.length)
    return (
      <p className="mt-10 text-center text-ink-muted">
        The agenda is being finalised. Check back soon.
      </p>
    );

  const mine = new Set(mineList.map((e) => e.session.id));
  const tabs = buildTabs(days);
  const tab = tabs.find((t) => t.key === tabParam) ?? null;
  const shownTracks = tab ? (tab.track ? [tab.track] : tab.day.tracks) : [];
  const photos = await signedUrls(
    "photos",
    shownTracks.flatMap((t) =>
      t.sessions.flatMap((s) => s.assignments.map((a) => a.person.photo_path)),
    ),
  );

  return (
    <>
      <TabBar tabs={tabs} active={tab?.key ?? "glance"} />

      {!tab ? (
        <>
          <div className="mt-5">
            <h1 className="font-display text-[1.9rem] font-semibold leading-tight">
              Programme at a glance
            </h1>
            <p className="text-ink-muted">
              {ev.dates} · {ev.venue} · {ev.timezoneLabel}
            </p>
          </div>
          <div className="mt-6">
            <Glance days={days} tabs={tabs} mine={mine} />
          </div>
        </>
      ) : (
        <>
          <div className="mt-5">
            <h1 className="font-display text-[1.9rem] font-semibold leading-tight">
              {tab.track ? tab.track.name : `${tab.label} · ${tab.day.label}`}
            </h1>
            {tab.track?.strapline && tab.track.strapline !== "TBC" && (
              <p className="mt-1 leading-snug">{tab.track.strapline}</p>
            )}
            <p className="mt-1 text-ink-muted">
              {formatLongDay(`${tab.day.date}T08:00:00Z`)}
              {tab.track && ` · ${tab.track.room ?? "Room TBC"}`} ·{" "}
              {ev.timezoneLabel}
            </p>
          </div>
          <div className="mt-6">
            <AgendaRows
              rows={shownTracks
                .flatMap((t) => t.sessions.map((x) => ({ ...x, track: t })))
                .sort(
                  (a, b) =>
                    a.start_time.localeCompare(b.start_time) ||
                    a.track.sort_order - b.track.sort_order,
                )}
              mine={mine}
              photos={photos}
            />
          </div>
        </>
      )}
    </>
  );
}

function Skeleton() {
  return (
    <div aria-busy="true" aria-label="Loading agenda">
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="mt-3 h-24 animate-pulse rounded-2xl bg-surface"
        />
      ))}
    </div>
  );
}

export default function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5">
      <Suspense fallback={<Skeleton />}>
        <AgendaContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
