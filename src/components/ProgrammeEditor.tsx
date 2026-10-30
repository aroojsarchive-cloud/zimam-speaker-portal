"use client";
import { useState, useTransition } from "react";
import {
  addHost,
  addSession,
  addToSession,
  deleteSession,
  removeFromSession,
  removeHost,
  saveSession,
  saveTrack,
  updateAssignment,
  type SessionInput,
} from "@/app/admin/programme-actions";

export type EditorAssignment = {
  id: string;
  role: string;
  status: string;
  presents: boolean;
  person: { name: string; placeholder: boolean };
};
export type EditorSession = {
  id: string;
  start: string; // HH:MM Dubai
  end: string;
  label: string;
  title: string;
  format: string;
  session_type: "speaking" | "non_speaking";
  status: "draft" | "published";
  description: string;
  assignments: EditorAssignment[];
  warning: string | null;
};
export type EditorHost = { id: string; role: string; name: string };
export type EditorTrack = {
  id: string;
  name: string;
  short_name: string;
  room: string;
  strapline: string;
  hosts: EditorHost[];
  sessions: EditorSession[];
};
export type PersonOption = { id: string; label: string };

const FORMATS = ["keynote", "panel", "fireside", "lecture", "opening", "closing", "break", "contest", "award", "workshop", "briefing", "pitches", "judging", "other"];
const ROLES = ["moderator", "panelist", "keynote", "speaker", "mc", "jury", "chair", "co_chair", "host"];
const STATUSES = ["confirmed", "tentative", "invited", "tbc"];
const field = "h-9 rounded-lg border border-line bg-surface px-2 text-sm outline-none focus:border-brand-strong focus:ring-2 focus:ring-brand/15";
const cap = (s: string) => s.replace(/_/g, "-").replace(/^./, (c) => c.toUpperCase());

function useAction() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.message ?? "Something went wrong.");
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 1600);
        after?.();
      }
    });
  return { pending, error, saved, run };
}

const HOST_ROLES = ["mc", "co_chair", "chair"];

function Hosts({ t, people }: { t: EditorTrack; people: PersonOption[] }) {
  const [who, setWho] = useState("");
  const [role, setRole] = useState("mc");
  const act = useAction();
  const match = people.find((p) => p.label === who);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold">Hosted by:</span>
      {t.hosts.length === 0 && <span className="text-ink-muted">nobody yet</span>}
      {t.hosts.map((h) => (
        <span key={h.id} className="flex items-center gap-1 rounded-full bg-brand-soft py-1 pl-3 pr-1">
          {h.name} <span className="text-ink-muted">({h.role === "mc" ? "MC" : cap(h.role)})</span>
          <button
            type="button"
            aria-label={`Remove ${h.name} as host`}
            onClick={() => act.run(() => removeHost(h.id))}
            className="grid h-6 w-6 place-items-center rounded-full text-ink-muted hover:bg-white"
          >
            ×
          </button>
        </span>
      ))}
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (match) act.run(() => addHost(t.id, { personId: match.id, role: role as "mc" }), () => setWho(""));
        }}
      >
        <input
          list={`hosts-${t.id}`}
          value={who}
          onChange={(e) => setWho(e.target.value)}
          placeholder="Add MC or co-chair"
          aria-label={`Add a host to ${t.name}`}
          className={`${field} min-w-56`}
        />
        <datalist id={`hosts-${t.id}`}>
          {people.map((p) => (
            <option key={p.id} value={p.label} />
          ))}
        </datalist>
        <select aria-label="Host role" className={field} value={role} onChange={(e) => setRole(e.target.value)}>
          {HOST_ROLES.map((r) => (
            <option key={r} value={r}>
              {r === "mc" ? "MC" : cap(r)}
            </option>
          ))}
        </select>
        <button disabled={!match || act.pending} className="h-9 rounded-lg bg-ink px-3 text-sm font-semibold text-white disabled:opacity-50">
          {act.pending ? "…" : "Add host"}
        </button>
      </form>
      {act.error && <span className="text-danger">{act.error}</span>}
    </div>
  );
}

function TrackHeader({ t }: { t: EditorTrack }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState({ name: t.name, short_name: t.short_name, room: t.room, strapline: t.strapline });
  const a = useAction();
  if (!editing)
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold">{t.name}</h2>
          <p className="text-sm text-ink-muted">
            {t.room || <span className="font-semibold text-warning">No room set</span>}
            {t.strapline ? ` · ${t.strapline}` : ""}
          </p>
        </div>
        <button onClick={() => setEditing(true)} className="h-9 rounded-lg px-3 text-sm font-semibold text-brand-strong hover:bg-brand-soft">
          Edit programme details
        </button>
      </div>
    );
  return (
    <form
      className="grid gap-2 rounded-2xl bg-surface p-4 shadow-[0_1px_0_var(--line)] md:grid-cols-4"
      onSubmit={(e) => {
        e.preventDefault();
        a.run(() => saveTrack(t.id, v), () => setEditing(false));
      }}
    >
      <label className="text-xs text-ink-muted md:col-span-2">
        Name
        <input className={`${field} w-full`} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </label>
      <label className="text-xs text-ink-muted">
        Tab label
        <input className={`${field} w-full`} value={v.short_name} onChange={(e) => setV({ ...v, short_name: e.target.value })} />
      </label>
      <label className="text-xs text-ink-muted">
        Room
        <input className={`${field} w-full`} value={v.room} onChange={(e) => setV({ ...v, room: e.target.value })} />
      </label>
      <label className="text-xs text-ink-muted md:col-span-4">
        Strapline
        <input className={`${field} w-full`} value={v.strapline} onChange={(e) => setV({ ...v, strapline: e.target.value })} />
      </label>
      <div className="flex items-center gap-2 md:col-span-4">
        <button disabled={a.pending} className="h-9 rounded-lg bg-brand-strong px-4 text-sm font-semibold text-white disabled:opacity-60">
          {a.pending ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-lg px-3 text-sm text-ink-muted">
          Cancel
        </button>
        {a.error && <span className="text-sm text-danger">{a.error}</span>}
      </div>
    </form>
  );
}

function AssignmentRow({ a }: { a: EditorAssignment }) {
  const act = useAction();
  const set = (patch: Partial<EditorAssignment>) =>
    act.run(() => updateAssignment(a.id, { role: patch.role ?? a.role, status: patch.status ?? a.status, presents: patch.presents ?? a.presents } as never));
  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
      <span className={`min-w-44 flex-1 font-semibold ${a.person.placeholder ? "italic text-ink-muted" : ""}`}>{a.person.name}</span>
      <select aria-label="Role" className={field} value={a.role} onChange={(e) => set({ role: e.target.value })}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {cap(r)}
          </option>
        ))}
      </select>
      <select aria-label="Status" className={field} value={a.status} onChange={(e) => set({ status: e.target.value })}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s === "tbc" ? "TBC" : cap(s)}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1.5 text-xs">
        <input type="checkbox" checked={a.presents} onChange={(e) => set({ presents: e.target.checked })} className="h-4 w-4 accent-[var(--brand-strong)]" />
        Presents slides
      </label>
      <button
        type="button"
        onClick={() => confirm(`Remove ${a.person.name} from this session?`) && act.run(() => removeFromSession(a.id))}
        className="h-8 rounded-lg px-2 text-xs text-danger hover:bg-danger/10"
      >
        Remove
      </button>
      {act.pending && <span className="text-xs text-ink-muted">Saving…</span>}
      {act.saved && <span className="text-xs text-success">Saved ✓</span>}
      {act.error && <span className="text-xs text-danger">{act.error}</span>}
    </li>
  );
}

function AddPerson({ sessionId, people }: { sessionId: string; people: PersonOption[] }) {
  const [who, setWho] = useState("");
  const [role, setRole] = useState("panelist");
  const act = useAction();
  const match = people.find((p) => p.label === who);
  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        act.run(() => addToSession(sessionId, { personId: match?.id ?? null, tbcLabel: match ? "" : who, role } as never), () => setWho(""));
      }}
    >
      <input
        list={`people-${sessionId}`}
        value={who}
        onChange={(e) => setWho(e.target.value)}
        placeholder="Add a person, or type e.g. “Panelist (TBC)”"
        className={`${field} min-w-72 flex-1`}
      />
      <datalist id={`people-${sessionId}`}>
        {people.map((p) => (
          <option key={p.id} value={p.label} />
        ))}
      </datalist>
      <select aria-label="Role for new person" className={field} value={role} onChange={(e) => setRole(e.target.value)}>
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {cap(r)}
          </option>
        ))}
      </select>
      <button disabled={!who.trim() || act.pending} className="h-9 rounded-lg bg-ink px-3 text-sm font-semibold text-white disabled:opacity-50">
        {act.pending ? "Adding…" : match ? "Add" : who.trim() ? "Add TBC slot" : "Add"}
      </button>
      {act.error && <span className="text-sm text-danger">{act.error}</span>}
    </form>
  );
}

function SessionRow({ s, date, people }: { s: EditorSession; date: string; people: PersonOption[] }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState<SessionInput>({
    date,
    start: s.start,
    end: s.end,
    label: s.label,
    title: s.title,
    format: s.format as SessionInput["format"],
    session_type: s.session_type,
    status: s.status,
    description: s.description,
  });
  const act = useAction();
  const set = <K extends keyof SessionInput>(k: K, val: SessionInput[K]) => setV((x) => ({ ...x, [k]: val }));
  const named = s.assignments.filter((a) => !a.person.placeholder);

  return (
    <li className={`border-b border-line px-4 py-3 last:border-0 ${s.status === "draft" ? "bg-paper" : ""}`}>
      {!editing ? (
        <div className="grid items-start gap-3 md:grid-cols-[7.5rem_1fr_auto]">
          <p className="font-display text-lg font-semibold tabular-nums">
            {s.start}–{s.end}
          </p>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.06em] text-brand-strong">
              {s.label || cap(s.format)}
              {s.status === "draft" && <span className="ml-2 rounded bg-warning/15 px-1.5 py-0.5 text-warning">Draft, hidden from speakers</span>}
            </p>
            <p className="font-semibold leading-snug">{s.title}</p>
            {s.session_type === "speaking" && (
              <p className="mt-0.5 text-sm text-ink-muted">
                {named.map((a) => `${a.person.name}${a.role === "moderator" ? " (mod)" : ""}${a.presents ? " ▣" : ""}`).join(", ") || "No named speakers"}
                {s.assignments.length > named.length && ` + ${s.assignments.length - named.length} TBC`}
              </p>
            )}
            {s.warning && <p className="mt-1 text-sm font-semibold text-warning">⚠ {s.warning}</p>}
          </div>
          <button onClick={() => setEditing(true)} className="h-9 rounded-lg border border-line px-3 text-sm font-semibold">
            Edit
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <form
            className="grid gap-2 md:grid-cols-[6rem_6rem_1fr_9rem_9rem_8rem]"
            onSubmit={(e) => {
              e.preventDefault();
              act.run(() => saveSession(s.id, v));
            }}
          >
            <label className="text-xs text-ink-muted">
              Start
              <input type="time" className={`${field} w-full`} value={v.start} onChange={(e) => set("start", e.target.value)} />
            </label>
            <label className="text-xs text-ink-muted">
              End
              <input type="time" className={`${field} w-full`} value={v.end} onChange={(e) => set("end", e.target.value)} />
            </label>
            <label className="text-xs text-ink-muted">
              Label (e.g. Panel 1 · Discussion Panel)
              <input className={`${field} w-full`} value={v.label} onChange={(e) => set("label", e.target.value)} />
            </label>
            <label className="text-xs text-ink-muted">
              Format
              <select className={`${field} w-full`} value={v.format} onChange={(e) => set("format", e.target.value as SessionInput["format"])}>
                {FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {cap(f)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-ink-muted">
              Type
              <select className={`${field} w-full`} value={v.session_type} onChange={(e) => set("session_type", e.target.value as SessionInput["session_type"])}>
                <option value="speaking">Speaking</option>
                <option value="non_speaking">Break / non-speaking</option>
              </select>
            </label>
            <label className="text-xs text-ink-muted">
              Visibility
              <select className={`${field} w-full`} value={v.status} onChange={(e) => set("status", e.target.value as SessionInput["status"])}>
                <option value="published">Published</option>
                <option value="draft">Draft (hidden)</option>
              </select>
            </label>
            <label className="text-xs text-ink-muted md:col-span-6">
              Title
              <input className={`${field} w-full`} value={v.title} onChange={(e) => set("title", e.target.value)} />
            </label>
            <label className="text-xs text-ink-muted md:col-span-6">
              Description (optional)
              <textarea rows={2} className={`${field} h-auto w-full py-2`} value={v.description} onChange={(e) => set("description", e.target.value)} />
            </label>
            <div className="flex flex-wrap items-center gap-2 md:col-span-6">
              <button disabled={act.pending} className="h-9 rounded-lg bg-brand-strong px-4 text-sm font-semibold text-white disabled:opacity-60">
                {act.pending ? "Saving…" : "Save session"}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="h-9 rounded-lg px-3 text-sm text-ink-muted">
                Close
              </button>
              {act.saved && <span className="text-sm text-success">Saved ✓ Speakers see it now.</span>}
              {act.error && <span className="text-sm text-danger">{act.error}</span>}
              <button
                type="button"
                onClick={() => confirm(`Delete “${s.title}”? Speakers on it will lose it from their portal.`) && act.run(() => deleteSession(s.id))}
                className="ml-auto h-9 rounded-lg px-3 text-sm text-danger hover:bg-danger/10"
              >
                Delete session
              </button>
            </div>
          </form>
          {v.session_type === "speaking" && (
            <div className="rounded-xl bg-paper px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-[0.08em] text-ink-muted">People on this session</p>
              <ul>
                {s.assignments.map((a) => (
                  <AssignmentRow key={a.id} a={a} />
                ))}
              </ul>
              <AddPerson sessionId={s.id} people={people} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function ProgrammeEditor({ tracks, date, people }: { tracks: EditorTrack[]; date: string; people: PersonOption[] }) {
  const act = useAction();
  return (
    <div className="space-y-10">
      {tracks.map((t) => (
        <section key={t.id}>
          <TrackHeader t={t} />
          <Hosts t={t} people={people} />
          <ol className="mt-3 overflow-hidden rounded-2xl bg-surface shadow-[0_1px_0_var(--line)]">
            {t.sessions.map((s) => (
              <SessionRow key={s.id} s={s} date={date} people={people} />
            ))}
          </ol>
          <button
            onClick={() => act.run(() => addSession(t.id, date, t.sessions.at(-1)?.end ?? "09:00"))}
            disabled={act.pending}
            className="mt-2 h-10 rounded-xl border border-dashed border-line px-4 text-sm font-semibold disabled:opacity-60"
          >
            {act.pending ? "Adding…" : "+ Add session at the end"}
          </button>
          {act.error && <span className="ml-3 text-sm text-danger">{act.error}</span>}
        </section>
      ))}
    </div>
  );
}
