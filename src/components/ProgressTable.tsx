import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { RelativeTime } from "@/components/RelativeTime";
import type { Step, StepKey } from "@/lib/prep";

export type ProgressRow = {
  id: string;
  name: string;
  org: string | null;
  photoUrl: string | null;
  email: string | null;
  lastLogin: string | null;
  roles: string;
  steps: Step[];
  slidesNote: string | null;
};

const COLS: { key: StepKey; label: string }[] = [
  { key: "details", label: "Details" },
  { key: "guidelines", label: "Guidelines" },
  { key: "session", label: "Session" },
  { key: "slides", label: "Slides" },
  { key: "brief", label: "Brief" },
  { key: "checkin", label: "In room" },
];

function Cell({ step, note }: { step: Step | undefined; note?: string | null }) {
  if (!step) return <td className="px-3 py-3 text-center text-ink-muted/50">–</td>;
  return (
    <td className="px-3 py-3 text-center">
      {step.done ? (
        <span title={note ?? "Done"} className="inline-grid h-7 min-w-7 place-items-center rounded-full bg-success px-1.5 text-xs font-bold text-white">
          {note ? note : "✓"}
        </span>
      ) : (
        <span title="Not yet" className="inline-block h-7 w-7 rounded-full border-2 border-line" />
      )}
    </td>
  );
}

export type ProgressGroup = { key: string; title: string; sub: string; rows: (ProgressRow & { roleHere?: string })[] };

export function ProgressTable({ groups }: { groups: ProgressGroup[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-surface shadow-[0_1px_0_var(--line)]">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-[0.1em] text-ink-muted">
            <th className="px-4 py-3 font-semibold">Speaker</th>
            <th className="px-3 py-3 font-semibold">Opened portal</th>
            {COLS.map((c) => (
              <th key={c.key} className="px-3 py-3 text-center font-semibold">
                {c.label}
              </th>
            ))}
            <th className="px-3 py-3 text-right font-semibold">Progress</th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.key}>
            {g.title && (
              <tr className="bg-paper">
                <th colSpan={COLS.length + 3} className="px-4 pb-2 pt-4 text-left font-normal">
                  <span className="block text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">{g.sub}</span>
                  <span className="block font-semibold">{g.title}</span>
                </th>
              </tr>
            )}
            {g.rows.map((r) => {
              const done = r.steps.filter((s) => s.done).length;
              return (
                <tr key={`${g.key}-${r.id}`} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.name} src={r.photoUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="font-semibold">{r.name}</p>
                        <p className="truncate text-xs text-ink-muted">{[r.roleHere ?? r.roles, r.org].filter(Boolean).join(" · ")}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {!r.email ? (
                      <Link href="/admin/people?filter=no-email" className="font-semibold text-warning underline">
                        No email
                      </Link>
                    ) : r.lastLogin ? (
                      <span className="text-success">
                        ✓ <RelativeTime iso={r.lastLogin} />
                      </span>
                    ) : (
                      <span className="text-ink-muted">Not yet</span>
                    )}
                  </td>
                  {COLS.map((c) => (
                    <Cell key={c.key} step={r.steps.find((s) => s.key === c.key)} note={c.key === "slides" ? r.slidesNote : null} />
                  ))}
                  <td className="px-3 py-3 text-right">
                    <span className="font-semibold tabular-nums">
                      {done}/{r.steps.length}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </div>
  );
}
