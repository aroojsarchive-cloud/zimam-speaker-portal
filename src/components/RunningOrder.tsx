import Link from "next/link";
import { formatLabel } from "@/lib/labels";
import { formatTime, minutesBetween } from "@/lib/time";
import type { SessionInfo } from "@/lib/speaker-data";

/**
 * The anti-walkout view: the room's running order around this session, with
 * what comes immediately before and after spelled out, breaks and non-speaking
 * segments included.
 */
export function RunningOrder({ sessions, currentId }: { sessions: SessionInfo[]; currentId: string }) {
  const i = sessions.findIndex((s) => s.id === currentId);
  const current = sessions[i];
  const blockIdx = sessions.flatMap((s, k) => (s.block_label && s.block_label === current.block_label ? [k] : []));
  const lo = Math.max(0, Math.min(i - 1, ...(blockIdx.length ? blockIdx : [i])));
  const hi = Math.min(sessions.length - 1, Math.max(i + 1, ...(blockIdx.length ? blockIdx : [i])));
  const window = sessions.slice(lo, hi + 1);

  return (
    <ol className="relative">
      {window.map((s, k) => {
        const idx = lo + k;
        const isCurrent = idx === i;
        const tag = idx === i - 1 ? "Before you" : idx === i + 1 ? "After you" : null;
        const isBreak = s.session_type === "non_speaking";
        return (
          <li key={s.id} className="relative flex gap-4">
            {/* time rail */}
            <div className="w-14 shrink-0 pt-3.5 text-right font-display text-[1.05rem] font-semibold tabular-nums">
              {formatTime(s.start_time)}
            </div>
            <div className="relative flex w-3 shrink-0 justify-center">
              <span aria-hidden className={`absolute inset-y-0 w-px bg-line ${k === 0 ? "top-5" : ""} ${k === window.length - 1 ? "bottom-auto h-5" : ""}`} />
              <span
                aria-hidden
                className={`relative mt-[1.15rem] h-3 w-3 rounded-full ${
                  isCurrent ? "bg-brand ring-4 ring-brand/20" : isBreak ? "border-2 border-ink-muted/50 bg-paper" : "bg-ink/70"
                }`}
              />
            </div>
            <div className={`mb-2 min-w-0 flex-1 rounded-2xl px-4 py-3 ${isCurrent ? "bg-brand-soft ring-1 ring-brand/40" : ""}`}>
              {(isCurrent || tag) && (
                <p
                  className={`text-xs font-bold uppercase tracking-[0.12em] ${isCurrent ? "text-brand-strong" : "text-ink"}`}
                >
                  {isCurrent ? "You are here" : tag}
                </p>
              )}
              {isCurrent ? (
                <p className="font-semibold leading-snug">{s.title}</p>
              ) : isBreak ? (
                <p className="leading-snug text-ink-muted">
                  <span className="font-semibold text-ink">{s.title}</span>
                  {s.label && s.label !== s.title ? ` · ${s.label}` : ""}
                </p>
              ) : (
                <Link href={`/sessions/${s.id}`} className="font-semibold leading-snug hover:underline">
                  {s.title}
                </Link>
              )}
              <p className="mt-0.5 text-sm text-ink-muted">
                {isBreak && s.format !== "break" ? "Non-speaking segment · " : ""}
                {s.format === "break" ? "" : `${formatLabel(s.format)} · `}
                {minutesBetween(s.start_time, s.end_time)} min
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
