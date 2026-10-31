"use client";
import { useState, useTransition } from "react";
import { checkIn, hostCheckIn } from "@/app/(speaker)/actions";
import { formatTime } from "@/lib/time";

/** Pass assignmentId + sessionId for a speaker, or hostTrackId for an MC / co-chair. */
export function CheckIn({
  assignmentId,
  sessionId,
  hostTrackId,
  checkedInAt,
}: {
  assignmentId?: string;
  sessionId?: string;
  hostTrackId?: string;
  checkedInAt: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (checkedInAt)
    return (
      <div className="rounded-2xl bg-success/10 px-5 py-4 text-center">
        <p className="font-display text-2xl font-semibold text-success">✓ You&apos;re checked in</p>
        <p className="text-[0.95rem] text-ink-muted">at {formatTime(checkedInAt)}. The team knows you&apos;re here.</p>
      </div>
    );
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = hostTrackId ? await hostCheckIn(hostTrackId) : await checkIn(assignmentId!, sessionId!);
            setError(r.ok ? null : r.message);
          })
        }
        className="h-16 w-full rounded-2xl bg-brand-strong font-display text-2xl font-semibold text-white shadow-[0_10px_24px_-12px_var(--brand-strong)] disabled:opacity-70"
      >
        {pending ? "Checking in…" : "I'm in the room"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-center text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
