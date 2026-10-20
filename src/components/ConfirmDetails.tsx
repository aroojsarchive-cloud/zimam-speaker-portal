"use client";
import { useRef, useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import { confirmMyDetails, flagMyDetails, saveMyPhoto } from "@/app/(speaker)/actions";

type Profile = {
  id: string;
  firstName: string;
  displayName: string;
  title: string | null;
  organisation: string | null;
  photoUrl: string | null;
  status: "unconfirmed" | "confirmed" | "change_requested";
  changeNote: string | null;
};

export function ConfirmDetails({ profile }: { profile: Profile }) {
  const [mode, setMode] = useState<"view" | "flag">("view");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "Something went wrong.");
      else setMode("view");
    });

  async function upload(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Please choose a photo (JPG or PNG).");
    if (file.size > 10 * 1024 * 1024) return setError("That photo is over 10 MB. Please choose a smaller one.");
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${profile.id}/${Date.now()}.${ext}`;
    const { error: upErr } = await createClient().storage.from("photos").upload(path, file, { contentType: file.type });
    if (upErr) {
      setUploading(false);
      return setError("Upload failed. Please try again.");
    }
    const r = await saveMyPhoto(path);
    setUploading(false);
    if (!r.ok) setError(r.message);
  }

  const confirmed = profile.status === "confirmed";

  return (
    <section id="profile" aria-labelledby="details-h" className="rounded-3xl bg-surface p-5 shadow-[0_1px_0_var(--line)]">
      <p className="text-sm text-ink-muted">Hi {profile.firstName}</p>
      <div className="mt-2 flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          aria-label={profile.photoUrl ? "Change your photo" : "Add your photo"}
          className="relative shrink-0 rounded-full disabled:opacity-60"
        >
          <Avatar name={profile.displayName} src={profile.photoUrl} size="xl" />
          <span
            aria-hidden
            className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-brand-strong text-lg font-bold leading-none text-white ring-4 ring-surface"
          >
            {uploading ? "…" : profile.photoUrl ? "✎" : "+"}
          </span>
        </button>
        <div className="min-w-0">
          <h1 id="details-h" className="font-display text-[1.6rem] font-semibold leading-[1.1]">
            {profile.displayName}
          </h1>
          <p className="mt-1 leading-snug">{profile.title ?? <em className="text-ink-muted">No title yet</em>}</p>
          <p className="leading-snug text-ink-muted">{profile.organisation ?? <em>No organisation yet</em>}</p>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
      />

      <div className="mt-4 border-t border-line pt-4">
        {confirmed ? (
          <p className="text-[0.95rem] font-semibold text-success">✓ You&apos;ve confirmed these details</p>
        ) : profile.status === "change_requested" ? (
          <p className="text-[0.95rem] font-semibold text-warning">Change requested: the team will update this</p>
        ) : (
          <p className="text-[0.95rem]">
            <span className="font-semibold">Are these details correct?</span>{" "}
            <span className="text-ink-muted">
              This is exactly how you&apos;ll appear on screen and in print{profile.photoUrl ? "" : ". Tap the photo to add yours"}.
            </span>
          </p>
        )}
      </div>

      {profile.status === "change_requested" && profile.changeNote && mode === "view" && (
        <p className="mt-2 rounded-xl bg-paper px-4 py-3 text-[0.95rem]">
          <span className="font-semibold">You told us:</span> {profile.changeNote}
          <br />
          <span className="text-ink-muted">The team will update this and let you know.</span>
        </p>
      )}

      {mode === "flag" ? (
        <div className="mt-3">
          <label htmlFor="flag-note" className="block font-medium">
            What should we change?
          </label>
          <textarea
            id="flag-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="e.g. My title is Director of Digital Health Strategy"
            className="mt-2 block w-full rounded-xl border border-line bg-paper px-4 py-3 outline-none focus:border-brand-strong focus:ring-4 focus:ring-brand/15"
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("view")}
              className="h-12 rounded-xl border border-line font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => flagMyDetails(note))}
              className="h-12 rounded-xl bg-brand-strong font-semibold text-white disabled:opacity-70"
            >
              {pending ? "Sending…" : "Send to the team"}
            </button>
          </div>
        </div>
      ) : (
        !confirmed && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMode("flag")}
              className="h-12 rounded-xl border border-line font-semibold"
            >
              Something&apos;s wrong
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(confirmMyDetails)}
              className="h-12 rounded-xl bg-brand-strong font-semibold text-white disabled:opacity-70"
            >
              {pending ? "Saving…" : "Looks right"}
            </button>
          </div>
        )
      )}
      {confirmed && mode === "view" && (
        <button type="button" onClick={() => setMode("flag")} className="mt-1 h-11 text-sm text-ink-muted underline underline-offset-4">
          Something changed? Tell us
        </button>
      )}
      {error && (
        <p role="alert" className="mt-3 text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
