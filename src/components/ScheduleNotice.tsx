import { eventConfig as ev } from "@/config/event";

/** "Subject to change" notice wherever speakers see times. */
export function ScheduleNotice({ compact = false }: { compact?: boolean }) {
  return (
    <p
      role="note"
      className={
        compact
          ? "text-sm text-ink-muted"
          : "flex gap-3 rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-[0.95rem] leading-snug"
      }
    >
      {!compact && (
        <span aria-hidden className="mt-0.5 font-bold text-warning">
          !
        </span>
      )}
      <span>{ev.scheduleNotice}</span>
    </p>
  );
}
