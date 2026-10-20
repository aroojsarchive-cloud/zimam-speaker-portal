import Link from "next/link";
import type { Step } from "@/lib/prep";

/** "Get ready": the speaker's preparation steps, with what's next one tap away. */
export function Checklist({ steps }: { steps: Step[] }) {
  const done = steps.filter((s) => s.done).length;
  const all = done === steps.length;
  return (
    <section aria-labelledby="prep-h" className="rounded-3xl bg-surface p-5 shadow-[0_1px_0_var(--line)]">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="prep-h" className="font-display text-xl font-semibold">
          {all ? "You're all set" : "Get ready"}
        </h2>
        <span className="text-sm font-semibold text-ink-muted">
          {done} of {steps.length} done
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
        <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(done / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-4 space-y-1">
        {steps.map((s, k) => {
          const body = (
            <>
              <span
                aria-hidden
                className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold ${
                  s.done ? "bg-success text-white" : "border-2 border-line text-ink-muted"
                }`}
              >
                {s.done ? "✓" : k + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block font-semibold leading-snug ${s.done ? "text-ink-muted line-through decoration-ink-muted/40" : ""}`}>
                  {s.label}
                </span>
                <span className="block text-sm leading-snug text-ink-muted">{s.detail}</span>
              </span>
              {!s.done && s.href && (
                <span aria-hidden className="self-center text-lg font-semibold text-brand-strong">
                  ›
                </span>
              )}
            </>
          );
          return (
            <li key={s.key}>
              <span className="sr-only">{s.done ? "Done: " : "To do: "}</span>
              {!s.done && s.href ? (
                <Link href={s.href} className="-mx-2 flex gap-3 rounded-xl px-2 py-2.5 hover:bg-paper">
                  {body}
                </Link>
              ) : (
                <div className="-mx-2 flex gap-3 px-2 py-2.5">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
