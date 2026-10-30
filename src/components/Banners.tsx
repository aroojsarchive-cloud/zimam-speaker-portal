
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
