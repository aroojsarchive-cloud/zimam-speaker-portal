import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getMyEngagements } from "@/lib/speaker-data";
import { displayName, roleLabel } from "@/lib/labels";
import { formatDay, formatRange } from "@/lib/time";

// What a speaker last acknowledged, per session. Short keys: this lives in a jsonb column.
// p: co-speaker names; i: their person ids in the same order (older snapshots have no i).
type SessionSnap = { t: string; s: string; e: string; r: string | null; roles: string[]; p: string[]; i?: string[] };
export type Snapshot = Record<string, SessionSnap>;
export type Notice = { sessionId: string | null; title: string; lines: string[] };

/** The speaker's programme as it stands now. */
export async function buildSnapshot(personId: string): Promise<Snapshot> {
  const engagements = await getMyEngagements(personId);
  const ids = [...new Set(engagements.map((e) => e.session.id))];
  const others = new Map<string, { id: string; name: string }[]>();
  if (ids.length) {
    const { data, error } = await (await createClient())
      .from("assignments")
      .select("session_id, person:people!inner(id, salutation, full_name, is_placeholder)")
      .in("session_id", ids);
    if (error) throw new Error(error.message);
    for (const a of (data ?? []) as unknown as { session_id: string; person: { id: string; salutation: string | null; full_name: string; is_placeholder: boolean } }[]) {
      if (a.person.id === personId || a.person.is_placeholder) continue;
      const list = others.get(a.session_id) ?? [];
      if (!list.some((o) => o.id === a.person.id)) others.set(a.session_id, [...list, { id: a.person.id, name: displayName(a.person) }]);
    }
  }
  const snap: Snapshot = {};
  for (const e of engagements) {
    const s = e.session;
    const hit = snap[s.id];
    if (hit) hit.roles = [...hit.roles, e.role].sort();
    else {
      const co = [...(others.get(s.id) ?? [])].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
      snap[s.id] = {
        t: s.title,
        // Normalised so timestamp formatting differences never count as a change.
        s: new Date(s.start_time).toISOString(),
        e: new Date(s.end_time).toISOString(),
        r: s.track.room,
        roles: [e.role],
        p: co.map((o) => o.name),
        i: co.map((o) => o.id),
      };
    }
  }
  return snap;
}

const when = (x: { s: string; e: string }) => `${formatDay(x.s)}, ${formatRange(x.s, x.e)}`;
const roles = (r: string[]) => r.map(roleLabel).join(" & ");

/** Human-readable differences between what they saw and what's true now. */
export function diffSnapshots(before: Snapshot, now: Snapshot): Notice[] {
  const notices: Notice[] = [];
  for (const [id, cur] of Object.entries(now)) {
    const old = before[id];
    if (!old) {
      notices.push({ sessionId: id, title: cur.t, lines: [`You've been added as ${roles(cur.roles)}: ${when(cur)}${cur.r ? `, ${cur.r}` : ""}.`] });
      continue;
    }
    const lines: string[] = [];
    if (old.s !== cur.s || old.e !== cur.e) lines.push(`New time: ${when(cur)} (was ${when(old)}).`);
    if (old.r !== cur.r) lines.push(`New room: ${cur.r ?? "to be confirmed"} (was ${old.r ?? "to be confirmed"}).`);
    if (old.t !== cur.t) lines.push(`New title (was “${old.t}”).`);
    if (old.roles.join() !== cur.roles.join()) lines.push(`Your role is now ${roles(cur.roles)} (was ${roles(old.roles)}).`);
    // Compare people by id when we can, so a corrected spelling isn't announced as a swap.
    const byId = old.i && cur.i;
    const joined = byId ? cur.p.filter((_, k) => !old.i!.includes(cur.i![k])) : cur.p.filter((n) => !old.p.includes(n));
    const left = byId ? old.p.filter((_, k) => !cur.i!.includes(old.i![k])) : old.p.filter((n) => !cur.p.includes(n));
    if (joined.length) lines.push(`Joining you: ${joined.join(", ")}.`);
    if (left.length) lines.push(`No longer on this session: ${left.join(", ")}.`);
    if (lines.length) notices.push({ sessionId: id, title: cur.t, lines });
  }
  for (const [id, old] of Object.entries(before))
    if (!now[id]) notices.push({ sessionId: null, title: old.t, lines: [`You're no longer on this session (${when(old)}). Questions? Message the speaker desk.`] });
  return notices;
}
