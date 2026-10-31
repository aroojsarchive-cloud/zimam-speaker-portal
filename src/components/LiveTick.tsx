"use client";
import { useTransition } from "react";
import { setCheckedIn, setHostCheckedIn } from "@/app/admin/actions";

/** Producer's manual check-in, for a speaker (assignmentId) or a host (hostId). */
export function LiveTick({ assignmentId, hostId, here }: { assignmentId?: string; hostId?: string; here: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await (hostId ? setHostCheckedIn(hostId, !here) : setCheckedIn(assignmentId!, !here))))}
      className={`h-8 rounded-lg px-3 text-xs font-semibold disabled:opacity-60 ${
        here ? "text-ink-muted hover:underline" : "bg-ink text-white"
      }`}
    >
      {pending ? "…" : here ? "Undo" : "Mark here"}
    </button>
  );
}
