"use client";
import { useState, useTransition } from "react";
import { setRoomDelay } from "@/app/admin/actions";

const STEPS = [0, 5, 10, 15, 20, 30];

/** One-tap "running late" for a room. Shifts Live and tells that room's speakers. */
export function RoomDelay({ trackId, minutes, setAt }: { trackId: string; minutes: number; setAt: string | null }) {
  const [pending, start] = useTransition();
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const set = (m: number) =>
    start(async () => {
      const r = await setRoomDelay(trackId, m);
      setError(r.ok ? null : r.message);
    });
  return (
    <div className={`mb-4 rounded-xl px-3 py-2 ${minutes ? "bg-warning/10" : "bg-paper"}`}>
      <p className={`text-sm font-semibold ${minutes ? "text-warning" : "text-ink-muted"}`}>
        {minutes ? `Running ${minutes} min late` : "On time"}
        {minutes && setAt ? <span className="font-normal"> · set {setAt}</span> : null}
        {pending && <span className="font-normal text-ink-muted"> · saving…</span>}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Set how late this room is running">
        {STEPS.map((m) => (
          <button
            key={m}
            type="button"
            disabled={pending}
            onClick={() => set(m)}
            aria-pressed={minutes === m}
            className={`h-9 min-w-11 rounded-lg px-2.5 text-sm font-semibold disabled:opacity-60 ${
              minutes === m ? "bg-ink text-white" : "border border-line bg-surface"
            }`}
          >
            {m === 0 ? "On time" : `+${m}`}
          </button>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (custom) set(Number(custom));
            setCustom("");
          }}
          className="flex items-center gap-1"
        >
          <input
            inputMode="numeric"
            aria-label="Custom minutes late"
            placeholder="min"
            value={custom}
            onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 3))}
            className="h-9 w-14 rounded-lg border border-line bg-surface px-2 text-sm"
          />
          <button disabled={!custom || pending} className="h-9 rounded-lg border border-line px-2.5 text-sm font-semibold disabled:opacity-50">
            Set
          </button>
        </form>
      </div>
      {error && <p className="mt-1 text-sm text-danger">{error}</p>}
    </div>
  );
}
