import { RelativeTime } from "@/components/RelativeTime";

export function RunningLateBanner({ minutes }: { minutes: number }) {
  if (minutes <= 0) return null;
  return (
    <div role="status" className="rounded-2xl bg-ink px-5 py-4 text-white">
      <p className="font-display text-xl font-semibold">Running about {minutes} minutes late</p>
      <p className="mt-0.5 text-[0.95rem] text-white/80">Times shown are the planned times. Allow for the delay.</p>
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
