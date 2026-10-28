"use client";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { PersonForm } from "@/components/PersonRow";
import { savePerson } from "@/app/admin/actions";

export type SpeakerView = {
  id: string;
  salutation: string | null;
  full_name: string;
  title: string | null;
  organisation: string | null;
  photoUrl: string | null;
  email: string | null;
  role: string;
  signedIn: boolean;
  detailsOk: boolean;
  changeNote: string | null;
  slides: "sent" | "none" | "waiting" | null; // null = not presenting
  inviteUrl: string | null;
  inviteText: string | null;
};

function Tick({ ok, label, warn }: { ok: boolean; label: string; warn?: boolean }) {
  return (
    <span className={`whitespace-nowrap text-sm ${ok ? "font-semibold text-success" : warn ? "font-semibold text-warning" : "text-ink-muted/70"}`}>
      {ok ? "✓" : "○"} {label}
    </span>
  );
}

/** One speaker on one session: who, their progress, and the buttons you need. */
export function SpeakerRow({ s }: { s: SpeakerView }) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  if (editing)
    return (
      <li className="border-b border-line px-4 py-4 last:border-0">
        <PersonForm
          initial={{ salutation: s.salutation ?? "", full_name: s.full_name, title: s.title ?? "", organisation: s.organisation ?? "", email: s.email ?? "" }}
          saveLabel="Save"
          onCancel={() => setEditing(false)}
          onSave={async (v) => {
            const r = await savePerson(s.id, v);
            if (r.ok) setEditing(false);
            return r;
          }}
        />
      </li>
    );
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-3 last:border-0">
      <div className="flex min-w-60 flex-1 items-center gap-3">
        <Avatar name={s.full_name} src={s.photoUrl} size="sm" />
        <div className="min-w-0 leading-tight">
          <p className="font-semibold">
            {[s.salutation, s.full_name].filter(Boolean).join(" ")} <span className="text-sm font-normal text-ink-muted">· {s.role}</span>
          </p>
          <p className="truncate text-sm text-ink-muted">{s.organisation ?? s.title ?? ""}</p>
          {s.changeNote && <p className="text-sm font-semibold text-warning">Asked to change: “{s.changeNote}”</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {s.email ? <Tick ok={s.signedIn} label="Signed in" /> : <span className="text-sm font-semibold text-warning">No email</span>}
        <Tick ok={s.detailsOk} label="Details OK" warn={!!s.changeNote} />
        {s.slides && <Tick ok={s.slides !== "waiting"} label={s.slides === "none" ? "No slides" : "Slides sent"} />}
      </div>
      <div className="flex gap-2">
        {s.inviteText && (
          <>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(s.inviteText!);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
              className="h-9 rounded-lg bg-ink px-3 text-sm font-semibold text-white"
            >
              {copied ? "Copied ✓" : "Copy invite"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(s.inviteText)}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center rounded-lg border border-line px-3 text-sm font-semibold"
            >
              WhatsApp
            </a>
          </>
        )}
        <button onClick={() => setEditing(true)} className="h-9 rounded-lg px-3 text-sm font-semibold text-brand-strong hover:bg-brand-soft">
          {s.email ? "Edit" : "Add email"}
        </button>
      </div>
    </li>
  );
}
