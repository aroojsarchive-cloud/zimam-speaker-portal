import Link from "next/link";
import { eventConfig as ev } from "@/config/event";
import { roleLabel } from "@/lib/labels";
import { formatDay, formatRange } from "@/lib/time";
import type { Engagement } from "@/lib/speaker-data";

/** One engagement, boarding-pass style: when and where first, then what. */
export function BoardingCard({ e, roles, slides }: { e: Engagement; roles: string[]; slides: "received" | "needed" | null }) {
  const s = e.session;
  const briefReady = s.notes.some((n) => n.kind === "published");
  return (
    <Link
      href={`/sessions/${s.id}`}
      className="group block overflow-hidden rounded-3xl bg-surface shadow-[0_1px_0_var(--line),0_12px_32px_-20px_rgb(0_0_0/0.35)] transition active:scale-[0.99]"
    >
      <div className="flex items-center gap-3 px-5 pt-4 text-sm">
        <span className="shrink-0 whitespace-nowrap font-semibold">{formatDay(s.start_time)}</span>
        <span className="flex min-w-0 items-center gap-2 text-ink-muted">
          <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.track.colour ?? ev.colours.brand }} />
          <span className="truncate">{s.track.name}</span>
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-end gap-4 px-5 pt-2 pb-4 font-display">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Time</p>
          <p className="text-[2.1rem] font-semibold leading-none tabular-nums">{formatRange(s.start_time, s.end_time)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">Room</p>
          <p className="text-[2.1rem] font-semibold leading-none">{s.track.room ?? "TBC"}</p>
        </div>
      </div>

      {/* perforation */}
      <div aria-hidden className="relative h-0 border-t-2 border-dashed border-line">
        <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-paper" />
        <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-paper" />
      </div>

      <div className="px-5 pt-4 pb-5">
        <div className="flex flex-wrap gap-2">
          {roles.map((r) => (
            <span key={r} className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-strong">
              {roleLabel(r)}
            </span>
          ))}
        </div>
        <h3 className="mt-3 text-[1.1rem] font-semibold leading-snug">{s.title}</h3>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span className={briefReady ? "font-semibold text-success" : "text-ink-muted"}>
              {briefReady ? "● Brief ready" : "○ Brief coming soon"}
            </span>
            {slides && (
              <span className={slides === "received" ? "font-semibold text-success" : "font-semibold text-brand-strong"}>
                {slides === "received" ? "● Slides received" : "+ Add your slides"}
              </span>
            )}
          </span>
          <span className="font-semibold text-brand-strong group-hover:underline">Open ›</span>
        </div>
      </div>
    </Link>
  );
}
