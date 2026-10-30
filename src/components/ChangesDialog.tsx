"use client";
import Link from "next/link";
import { useEffect, useRef, useTransition } from "react";
import { acknowledgeChanges } from "@/app/(speaker)/actions";
import type { Notice } from "@/lib/changes";

/** Pops up whenever something about the speaker's sessions changed since they last said "Got it". */
export function ChangesDialog({ notices }: { notices: Notice[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
  }, [notices]);
  const ok = () => start(async () => void (await acknowledgeChanges()));
  return (
    <dialog
      ref={ref}
      aria-labelledby="changes-h"
      onCancel={(e) => e.preventDefault()}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-3xl bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink/50"
    >
      <div className="max-h-[80vh] overflow-y-auto p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-brand-strong">Programme update</p>
        <h2 id="changes-h" className="mt-1 font-display text-2xl font-semibold leading-tight">
          {notices.length === 1 ? "One of your sessions has changed" : "Some of your sessions have changed"}
        </h2>
        <ul className="mt-4 space-y-4">
          {notices.map((n, i) => (
            <li key={`${n.sessionId}-${i}`} className="rounded-2xl bg-paper p-4">
              <p className="font-semibold leading-snug">{n.title}</p>
              <ul className="mt-1 space-y-1 text-[0.95rem]">
                {n.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {n.sessionId && (
                <Link href={`/sessions/${n.sessionId}`} onClick={ok} className="mt-2 inline-block text-sm font-semibold text-brand-strong underline underline-offset-4">
                  See the session
                </Link>
              )}
            </li>
          ))}
        </ul>
        <button
          onClick={ok}
          disabled={pending}
          autoFocus
          className="mt-5 h-12 w-full rounded-xl bg-brand-strong font-semibold text-white disabled:opacity-70"
        >
          {pending ? "One moment…" : "Got it"}
        </button>
      </div>
    </dialog>
  );
}

/** First visit: remember what they're seeing now, so later changes can be shown. */
export function RememberProgramme() {
  useEffect(() => {
    const t = setTimeout(() => void acknowledgeChanges(), 1000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
