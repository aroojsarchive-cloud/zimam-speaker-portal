"use client";
import { useState, useTransition } from "react";
import { markReviewed, setNoSlides } from "@/app/(speaker)/actions";

export function ReviewedButton({ ids, sessionId, reviewed }: { ids: string[]; sessionId: string; reviewed: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (reviewed)
    return <p className="mt-4 rounded-xl bg-success/10 px-4 py-3 text-center font-semibold text-success">✓ You&apos;ve checked this session</p>;
  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await markReviewed(ids, sessionId);
            setError(r.ok ? null : r.message);
          })
        }
        className="h-12 w-full rounded-xl bg-brand-strong font-semibold text-white disabled:opacity-70"
      >
        {pending ? "Saving…" : "I've checked my session"}
      </button>
      <p className="mt-2 text-center text-sm text-ink-muted">Time, room, running order and who you&apos;re with all look right.</p>
      {error && <p role="alert" className="mt-2 text-center text-danger">{error}</p>}
    </div>
  );
}

export function NoSlidesToggle({ ids, sessionId, noSlides }: { ids: string[]; sessionId: string; noSlides: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await setNoSlides(ids, sessionId, !noSlides)))}
      className="mt-2 h-11 w-full text-sm font-semibold text-ink-muted underline underline-offset-4 disabled:opacity-60"
    >
      {pending ? "Saving…" : noSlides ? "Actually, I will use slides" : "I'm not using slides"}
    </button>
  );
}
