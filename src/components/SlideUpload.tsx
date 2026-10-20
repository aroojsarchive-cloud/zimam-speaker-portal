"use client";
import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { recordSlides } from "@/app/(speaker)/actions";
import { RelativeTime } from "@/components/RelativeTime";

// Keynote files are folders on a Mac and usually can't be uploaded from a browser: ask for an export instead.
const ACCEPT = [".pptx", ".ppt", ".pdf"];
const MAX_MB = 50;

export type Submission = { id: string; file_name: string; uploaded_at: string; size_bytes: number | null; url: string | null };

const mb = (b: number | null) => (b ? `${(b / 1024 / 1024).toFixed(1)} MB` : "");

export function SlideUpload({ sessionId, personId, submissions, due }: { sessionId: string; personId: string; submissions: Submission[]; due: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = submissions[0];

  async function upload(file: File) {
    setError(null);
    const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;
    if (ext === ".key") return setError("Keynote files can't be uploaded. In Keynote choose File › Export To › PowerPoint (or PDF), then upload that.");
    if (!ACCEPT.includes(ext)) return setError("Please upload a PowerPoint or PDF file.");
    if (file.size > MAX_MB * 1024 * 1024)
      return setError(`That file is over ${MAX_MB} MB. Try saving it with compressed images, or send it to the team.`);
    setBusy(true);
    const safe = file.name.replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "-").slice(-80) || `slides${ext}`;
    const path = `${sessionId}/${personId}/${Date.now()}-${safe}`;
    const { error: upErr } = await createClient().storage.from("slides").upload(path, file, { contentType: file.type || undefined });
    if (upErr) {
      setBusy(false);
      return setError("Upload failed. Please check your connection and try again.");
    }
    const r = await recordSlides(sessionId, path, file.name, file.size);
    setBusy(false);
    if (!r.ok) setError(r.message);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      {latest ? (
        <div className="rounded-2xl bg-success/10 px-4 py-3">
          <p className="font-semibold text-success">✓ Slides received</p>
          <p className="mt-0.5 break-all text-[0.95rem]">
            {latest.url ? (
              <a href={latest.url} className="underline underline-offset-4">
                {latest.file_name}
              </a>
            ) : (
              latest.file_name
            )}
          </p>
          <p className="text-sm text-ink-muted">
            Uploaded <RelativeTime iso={latest.uploaded_at} />
            {latest.size_bytes ? ` · ${mb(latest.size_bytes)}` : ""}
          </p>
        </div>
      ) : (
        <p className="text-ink-muted">
          Please upload your slides by <span className="font-semibold text-ink">{due}</span> so the AV team can load and test them. If
          they&apos;re not ready by then, just bring them on a USB stick on the day.
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="sr-only"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className={`mt-4 h-12 w-full rounded-xl font-semibold disabled:opacity-70 ${
          latest ? "border border-line" : "bg-brand-strong text-white"
        }`}
      >
        {busy ? "Uploading…" : latest ? "Upload a new version" : "Upload slides"}
      </button>
      <p className="mt-2 text-center text-sm text-ink-muted">
        PowerPoint or PDF, up to {MAX_MB} MB. Using Keynote? Export to PowerPoint or PDF first.
      </p>
      {error && (
        <p role="alert" className="mt-2 text-center text-danger">
          {error}
        </p>
      )}
      {submissions.length > 1 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-ink-muted">Earlier versions ({submissions.length - 1})</summary>
          <ul className="mt-2 space-y-1">
            {submissions.slice(1).map((s) => (
              <li key={s.id} className="flex justify-between gap-3">
                <span className="truncate">{s.file_name}</span>
                <span className="shrink-0 text-ink-muted">
                  <RelativeTime iso={s.uploaded_at} />
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
