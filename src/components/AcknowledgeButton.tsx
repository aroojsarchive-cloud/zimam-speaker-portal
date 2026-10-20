"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acknowledgeGuidelines } from "@/app/(speaker)/actions";

export function AcknowledgeButton({ label, thanks, done }: { label: string; thanks: string; done: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  if (done)
    return (
      <div className="rounded-2xl bg-success/10 px-5 py-4 text-center">
        <p className="font-semibold text-success">✓ {thanks}</p>
      </div>
    );
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await acknowledgeGuidelines();
            if (!r.ok) setError(r.message);
            else router.refresh();
          })
        }
        className="h-14 w-full rounded-xl bg-brand-strong text-lg font-semibold text-white disabled:opacity-70"
      >
        {pending ? "Saving…" : label}
      </button>
      {error && <p role="alert" className="mt-2 text-center text-danger">{error}</p>}
    </div>
  );
}
