"use client";
import { useTransition } from "react";
import { setCheckedIn } from "@/app/admin/actions";

export function LiveTick({ assignmentId, here }: { assignmentId: string; here: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await setCheckedIn(assignmentId, !here)))}
      className={`h-8 rounded-lg px-3 text-xs font-semibold disabled:opacity-60 ${
        here ? "text-ink-muted hover:underline" : "bg-ink text-white"
      }`}
    >
      {pending ? "…" : here ? "Undo" : "Mark here"}
    </button>
  );
}
