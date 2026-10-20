import { RelativeTime } from "@/components/RelativeTime";
import type { ConceptNote } from "@/lib/speaker-data";

const lines = (t: string | null) => (t ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

export function Brief({ note, me, fileUrl }: { note: ConceptNote | null; me: string; fileUrl: string | null }) {
  if (!note)
    return (
      <div className="rounded-2xl bg-paper px-5 py-4">
        <p className="font-semibold">Your brief is being finalised</p>
        <p className="mt-0.5 text-[0.95rem] text-ink-muted">We&apos;ll email you when it&apos;s ready.</p>
      </div>
    );

  const objectives = lines(note.objectives);
  const hasStructured = note.summary || objectives.length || note.key_questions.length || note.format_notes;

  return (
    <div className="space-y-6">
      <p className="text-sm text-ink-muted">
        Updated <RelativeTime iso={note.updated_at} /> · version {note.version}
      </p>

      {note.summary && <p className="text-[1.05rem] leading-relaxed">{note.summary}</p>}

      {objectives.length > 0 && (
        <div>
          <h3 className="font-display text-lg font-semibold">Objectives</h3>
          <ul className="mt-2 space-y-2">
            {objectives.map((o) => (
              <li key={o} className="flex gap-3">
                <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {note.key_questions.length > 0 && (
        <div>
          <h3 className="font-display text-lg font-semibold">Key questions</h3>
          <ol className="mt-2 space-y-2">
            {note.key_questions.map((q, k) => {
              const mine = q.person_id === me;
              return (
                <li key={k} className={`flex gap-3 rounded-2xl px-4 py-3 ${mine ? "bg-brand-soft ring-1 ring-brand/40" : "bg-paper"}`}>
                  <span className="font-display text-lg font-semibold tabular-nums text-ink-muted">{k + 1}</span>
                  <div>
                    {mine && <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-strong">Your question</p>}
                    <p>{q.text}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {note.format_notes && (
        <div>
          <h3 className="font-display text-lg font-semibold">How it will run</h3>
          <p className="mt-2 whitespace-pre-line leading-relaxed">{note.format_notes}</p>
        </div>
      )}

      {fileUrl && (
        <a
          href={fileUrl}
          className="flex h-14 items-center justify-center rounded-xl bg-brand-strong font-semibold text-white"
          download={note.file_name ?? undefined}
        >
          Download {hasStructured ? "the full " : ""}brief{note.file_name ? ` (${note.file_name.split(".").pop()?.toUpperCase()})` : ""}
        </a>
      )}
    </div>
  );
}
