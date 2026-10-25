import { RelativeTime } from "@/components/RelativeTime";

/** Shown to a speaker whose room is behind schedule today. */
export function RunningLateBanner({ room, minutes, startsAround }: { room: string; minutes: number; startsAround: string }) {
  return (
    <div role="status" className="rounded-2xl bg-ink px-5 py-4 text-white">
      <p className="font-display text-xl font-semibold">
        {room} is running about {minutes} minutes late
      </p>
      <p className="mt-0.5 text-[0.95rem] text-white/85">
        Your session should now start around <span className="font-semibold text-white">{startsAround}</span>. We&apos;ll update this if
        it changes.
      </p>
    </div>
  );
}

export function ChangedBanner({ at }: { at: string }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl bg-brand-soft px-5 py-4">
      <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />
      <div>
        <p className="font-semibold">Your sessions were updated</p>
        <p className="text-[0.95rem] text-ink-muted">
          Last change <RelativeTime iso={at} />. Everything below is the latest version.
        </p>
      </div>
    </div>
  );
}
