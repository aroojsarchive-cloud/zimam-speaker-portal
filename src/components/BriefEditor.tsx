"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Brief } from "@/components/Brief";
import { publishBrief, saveDraft, type DraftInput } from "@/app/(speaker)/sessions/[id]/brief/actions";

type Panelist = { id: string; name: string; role: string };

const box =
  "mt-2 block w-full rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-brand-strong focus:ring-4 focus:ring-brand/15";

export function BriefEditor({
  sessionId,
  me,
  initial,
  panel,
  publishedVersion,
  audience,
}: {
  sessionId: string;
  me: string;
  initial: DraftInput;
  panel: Panelist[];
  publishedVersion: number | null;
  audience: number;
}) {
  const router = useRouter();
  const [d, setD] = useState<DraftInput>(initial);
  const [status, setStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [publishing, startPublish] = useTransition();
  const first = useRef(true);
  const fileRef = useRef<HTMLInputElement>(null);

  // Autosave the draft 1.2s after typing stops. Speakers never see drafts.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStatus("unsaved");
    const t = setTimeout(async () => {
      setStatus("saving");
      const r = await saveDraft(sessionId, d);
      setStatus(r.ok ? "saved" : "error");
    }, 1200);
    return () => clearTimeout(t);
  }, [d, sessionId]);

  const set = <K extends keyof DraftInput>(k: K, v: DraftInput[K]) => setD((x) => ({ ...x, [k]: v }));

  async function upload(file: File) {
    setMessage(null);
    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (![".pdf", ".docx", ".doc"].includes(ext)) return setMessage("Please upload a PDF or Word file.");
    if (file.size > 20 * 1024 * 1024) return setMessage("That file is over 20 MB.");
    setUploading(true);
    const path = `${sessionId}/${Date.now()}-${file.name.replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").slice(-80)}`;
    const { error } = await createClient().storage.from("briefs").upload(path, file, { contentType: file.type || undefined });
    setUploading(false);
    if (error) return setMessage("Upload failed. Please try again.");
    setD((x) => ({ ...x, file_path: path, file_name: file.name }));
  }

  const empty = !d.summary.trim() && !d.objectives.trim() && !d.questions_text.trim() && !d.format_notes.trim() && !d.file_path;

  if (preview)
    return (
      <div>
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-white">
          <p className="text-sm">Preview: exactly what your panel will see</p>
          <button onClick={() => setPreview(false)} className="h-9 rounded-lg bg-white px-3 text-sm font-semibold text-ink">
            Back to editing
          </button>
        </div>
        <div className="rounded-3xl bg-surface p-5 shadow-[0_1px_0_var(--line)]">
          <Brief
            me={me}
            meName={null}
            fileUrl={d.file_path ? "#" : null}
            note={{
              summary: d.summary || null,
              objectives: d.objectives || null,
              key_questions: [],
              questions_text: d.questions_text || null,
              format_notes: d.format_notes || null,
              run_of_show: null,
              file_path: d.file_path,
              file_name: d.file_name,
              version: (publishedVersion ?? 0) + 1,
              updated_at: new Date().toISOString(),
            }}
          />
        </div>
      </div>
    );

  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-muted" aria-live="polite">
        {status === "saving" ? "Saving draft…" : status === "unsaved" ? "Editing…" : status === "error" ? "⚠ Not saved. Check your connection." : "✓ Draft saved"}
        {" · "}
        {publishedVersion ? `Version ${publishedVersion} is live. Changes stay private until you publish again.` : "Not published yet: only you can see this."}
      </p>

      <label className="block">
        <span className="font-semibold">Summary</span>
        <span className="block text-sm text-ink-muted">Two or three sentences: what this session is about.</span>
        <textarea className={box} rows={4} value={d.summary} onChange={(e) => set("summary", e.target.value)} />
      </label>

      <label className="block">
        <span className="font-semibold">Objectives</span>
        <span className="block text-sm text-ink-muted">One per line.</span>
        <textarea className={box} rows={4} value={d.objectives} onChange={(e) => set("objectives", e.target.value)} />
      </label>

      <label className="block">
        <span className="font-semibold">Key questions</span>
        <span className="block text-sm text-ink-muted">
          Paste them in as they are, in any format. Mention a panelist by name and that line is highlighted for them
          {panel.length ? `: ${panel.map((p) => p.name).join(", ")}` : ""}.
        </span>
        <textarea className={box} rows={10} value={d.questions_text} onChange={(e) => set("questions_text", e.target.value)} />
      </label>

      <label className="block">
        <span className="font-semibold">How it will run</span>
        <span className="block text-sm text-ink-muted">Format, timings, slides or not, when to be on stage.</span>
        <textarea className={box} rows={4} value={d.format_notes} onChange={(e) => set("format_notes", e.target.value)} />
      </label>

      <div>
        <p className="font-semibold">Or attach your concept note</p>
        <p className="text-sm text-ink-muted">PDF or Word. Your panel gets a download button.</p>
        {d.file_name && (
          <p className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-paper px-4 py-3">
            <span className="truncate">📄 {d.file_name}</span>
            <button type="button" onClick={() => setD((x) => ({ ...x, file_path: null, file_name: null }))} className="text-sm text-danger">
              Remove
            </button>
          </p>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className="mt-2 h-11 rounded-xl border border-line px-4 font-semibold disabled:opacity-60">
          {uploading ? "Uploading…" : d.file_name ? "Replace file" : "Upload file"}
        </button>
      </div>

      {message && <p role="alert" className="text-danger">{message}</p>}

      <div className="sticky bottom-0 -mx-4 grid grid-cols-2 gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <button type="button" onClick={() => setPreview(true)} disabled={empty} className="h-12 rounded-xl border border-line font-semibold disabled:opacity-50">
          Preview
        </button>
        <button
          type="button"
          disabled={empty || publishing || status === "saving"}
          onClick={() => {
            if (!confirm(`Publish this brief? ${audience} ${audience === 1 ? "person" : "people"} on this session will see it straight away.`)) return;
            startPublish(async () => {
              const r = await publishBrief(sessionId, d);
              if (!r.ok) return setMessage(r.message);
              router.push(`/sessions/${sessionId}?published=1#brief-h`);
            });
          }}
          className="h-12 rounded-xl bg-brand-strong font-semibold text-white disabled:opacity-50"
        >
          {publishing ? "Publishing…" : publishedVersion ? "Publish update" : "Publish"}
        </button>
      </div>
    </div>
  );
}
