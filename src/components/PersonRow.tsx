"use client";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { RelativeTime } from "@/components/RelativeTime";
import { addPerson, resetInviteLink, savePerson, setPresents, type PersonInput } from "@/app/admin/actions";

export type PersonView = {
  id: string;
  salutation: string | null;
  full_name: string;
  title: string | null;
  organisation: string | null;
  photoUrl: string | null;
  email: string | null;
  details_status: string;
  change_note: string | null;
  last_login_at: string | null;
  sessions: { assignmentId: string; title: string; role: string; time: string; presents: boolean; speaking: boolean }[];
  inviteUrl: string | null;
  inviteText: string | null;
};

const field = "h-10 w-full rounded-lg border border-line bg-paper px-3 outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand/15";

function PersonForm({ initial, onSave, onCancel, saveLabel }: {
  initial: PersonInput;
  onSave: (v: PersonInput) => Promise<{ ok: boolean; message?: string }>;
  onCancel: () => void;
  saveLabel: string;
}) {
  const [v, setV] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof PersonInput) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  return (
    <form
      className="grid gap-3 md:grid-cols-[6rem_1fr_1fr]"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await onSave(v);
          setError(r.ok ? null : (r.message ?? "Couldn't save."));
        });
      }}
    >
      <label className="text-sm">
        Salutation
        <input className={field} value={v.salutation ?? ""} onChange={set("salutation")} placeholder="Dr" />
      </label>
      <label className="text-sm">
        Full name
        <input className={field} value={v.full_name} onChange={set("full_name")} required autoFocus />
      </label>
      <label className="text-sm">
        Email (their username)
        <input className={field} type="email" value={v.email ?? ""} onChange={set("email")} placeholder="name@organisation.org" />
      </label>
      <label className="text-sm md:col-span-2">
        Title
        <input className={field} value={v.title ?? ""} onChange={set("title")} />
      </label>
      <label className="text-sm">
        Organisation
        <input className={field} value={v.organisation ?? ""} onChange={set("organisation")} />
      </label>
      <div className="flex items-center gap-3 md:col-span-3">
        <button disabled={pending} className="h-10 rounded-lg bg-brand-strong px-5 font-semibold text-white disabled:opacity-70">
          {pending ? "Saving…" : saveLabel}
        </button>
        <button type="button" onClick={onCancel} className="h-10 rounded-lg px-4 text-ink-muted hover:bg-line/50">
          Cancel
        </button>
        {error && <p role="alert" className="text-danger">{error}</p>}
      </div>
    </form>
  );
}

export function PersonRow({ p }: { p: PersonView }) {
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [, start] = useTransition();

  const copy = async (what: "link" | "message") => {
    const text = what === "link" ? p.inviteUrl : p.inviteText;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 1800);
  };

  const status =
    p.details_status === "confirmed"
      ? { text: "Confirmed", cls: "bg-success/10 text-success" }
      : p.details_status === "change_requested"
        ? { text: "Change requested", cls: "bg-warning/10 text-warning" }
        : { text: "Not confirmed", cls: "bg-line/70 text-ink-muted" };

  return (
    <li className="border-b border-line px-5 py-4 last:border-0">
      {editing ? (
        <PersonForm
          initial={{ salutation: p.salutation ?? "", full_name: p.full_name, title: p.title ?? "", organisation: p.organisation ?? "", email: p.email ?? "" }}
          saveLabel="Save"
          onCancel={() => setEditing(false)}
          onSave={async (v) => {
            const r = await savePerson(p.id, v);
            if (r.ok) setEditing(false);
            return r;
          }}
        />
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto]">
          <div className="flex min-w-0 gap-3">
            <Avatar name={p.full_name} src={p.photoUrl} size="sm" />
            <div className="min-w-0">
              <p className="font-semibold">{[p.salutation, p.full_name].filter(Boolean).join(" ")}</p>
              <p className="text-sm text-ink-muted">{[p.title, p.organisation].filter(Boolean).join(", ") || <em>No title or organisation</em>}</p>
              <ul className="mt-1 space-y-0.5 text-sm">
                {p.sessions.map((s) => (
                  <li key={s.assignmentId} className="flex items-center gap-2">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold text-brand-strong">{s.role}</span> · {s.time} · {s.title}
                    </span>
                    {s.speaking && (
                      <button
                        type="button"
                        onClick={() => start(async () => void (await setPresents(s.assignmentId, !s.presents)))}
                        title={s.presents ? "Asked to upload slides. Click to stop asking." : "Not asked for slides. Click to ask for slides."}
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                          s.presents ? "bg-brand-soft text-brand-strong" : "border border-line text-ink-muted"
                        }`}
                      >
                        {s.presents ? "Presenting slides" : "No slides"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="min-w-0 text-sm">
            {p.email ? <p className="truncate">{p.email}</p> : <p className="font-semibold text-warning">No email: can&apos;t sign in</p>}
            <p className="mt-1">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${status.cls}`}>{status.text}</span>
            </p>
            {p.change_note && <p className="mt-1 text-warning">“{p.change_note}”</p>}
            <p className="mt-1 text-ink-muted">
              {p.last_login_at ? <>Signed in <RelativeTime iso={p.last_login_at} /></> : "Never signed in"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 md:justify-end">
            {p.inviteUrl && (
              <>
                <button onClick={() => copy("message")} className="h-9 rounded-lg bg-ink px-3 text-sm font-semibold text-white">
                  {copied === "message" ? "Copied ✓" : "Copy invite"}
                </button>
                <button onClick={() => copy("link")} className="h-9 rounded-lg border border-line px-3 text-sm font-semibold">
                  {copied === "link" ? "Copied ✓" : "Copy link"}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(p.inviteText ?? "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 items-center rounded-lg border border-line px-3 text-sm font-semibold"
                >
                  WhatsApp
                </a>
              </>
            )}
            <button onClick={() => setEditing(true)} className="h-9 rounded-lg px-3 text-sm font-semibold text-brand-strong hover:bg-brand-soft">
              Edit
            </button>
            {p.inviteUrl && (
              <button
                onClick={() => confirm("Make a new link? The old one will stop working.") && start(async () => void (await resetInviteLink(p.id)))}
                className="h-9 rounded-lg px-2 text-xs text-ink-muted hover:underline"
              >
                New link
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export function AddPerson() {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="h-10 rounded-lg bg-brand-strong px-4 font-semibold text-white">
        + Add person
      </button>
    );
  return (
    <div className="mt-4 w-full rounded-2xl bg-surface p-5 shadow-[0_1px_0_var(--line)]">
      <PersonForm
        initial={{ salutation: "", full_name: "", title: "", organisation: "", email: "" }}
        saveLabel="Add"
        onCancel={() => setOpen(false)}
        onSave={async (v) => {
          const r = await addPerson(v);
          if (r.ok) setOpen(false);
          return r;
        }}
      />
    </div>
  );
}
