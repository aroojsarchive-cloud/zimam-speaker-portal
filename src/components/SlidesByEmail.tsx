"use client";
import { useState, useTransition } from "react";
import { markSlidesSent, setNoSlides } from "@/app/(speaker)/actions";
import { RelativeTime } from "@/components/RelativeTime";

/** Presenters email their slides to the producer, then tell us here so the team can track it. */
export function SlidesByEmail({
  ids,
  sessionId,
  email,
  due,
  subject,
  sentAt,
  noSlides,
}: {
  ids: string[];
  sessionId: string;
  email: string;
  due: string;
  subject: string;
  sentAt: string | null;
  noSlides: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setError(r.ok ? null : (r.message ?? "Something went wrong."));
    });
  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
    "Hello,\n\nPlease find my slides attached.\n\nThank you,\n",
  )}`;

  if (noSlides && !sentAt)
    return (
      <div>
        <p className="rounded-2xl bg-paper px-4 py-3 text-ink-muted">You&apos;ve told us you&apos;re not using slides.</p>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setNoSlides(ids, sessionId, false))}
          className="mt-2 h-11 w-full text-sm font-semibold text-ink-muted underline underline-offset-4 disabled:opacity-60"
        >
          Actually, I will use slides
        </button>
      </div>
    );

  return (
    <div>
      {sentAt ? (
        <div className="rounded-2xl bg-success/10 px-4 py-3">
          <p className="font-semibold text-success">✓ You&apos;ve sent your slides</p>
          <p className="text-sm text-ink-muted">
            Marked <RelativeTime iso={sentAt} />. Sending an updated version? Just email it to {email} again.
          </p>
        </div>
      ) : (
        <p>
          Please email your slides to{" "}
          <a href={mailto} className="font-semibold text-brand-strong underline underline-offset-4">
            {email}
          </a>{" "}
          by <span className="font-semibold">{due}</span> so the AV team can load and test them. If they&apos;re not ready by then, just
          bring them on a USB stick on the day.
        </p>
      )}

      <a href={mailto} className="mt-4 flex h-12 w-full items-center justify-center rounded-xl bg-brand-strong font-semibold text-white">
        {sentAt ? "Email an updated version" : "Email my slides"}
      </a>
      <p className="mt-2 text-center text-sm text-ink-muted">Opens your email with the subject filled in. Attach your PowerPoint or PDF.</p>

      {!sentAt ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => markSlidesSent(ids, sessionId, true))}
            className="h-12 rounded-xl border border-line font-semibold disabled:opacity-60"
          >
            {pending ? "Saving…" : "I've emailed them"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setNoSlides(ids, sessionId, true))}
            className="h-12 rounded-xl border border-line font-semibold text-ink-muted disabled:opacity-60"
          >
            Not using slides
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => markSlidesSent(ids, sessionId, false))}
          className="mt-2 h-11 w-full text-sm text-ink-muted underline underline-offset-4 disabled:opacity-60"
        >
          Undo: I haven&apos;t sent them yet
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-center text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
