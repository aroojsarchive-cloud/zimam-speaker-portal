import { Avatar } from "@/components/Avatar";
import { displayName, roleLabel } from "@/lib/labels";
import type { StageMember } from "@/lib/speaker-data";

export function StageList({ members, me, photos }: { members: StageMember[]; me: string; photos: Map<string, string> }) {
  if (!members.length) return <p className="text-ink-muted">Speakers for this session will be announced soon.</p>;
  return (
    <ul className="divide-y divide-line">
      {members.map((m, k) => {
        const p = m.person;
        const name = p.is_placeholder ? p.full_name : displayName(p);
        return (
          <li key={`${p.id}-${m.role}-${k}`} className="flex items-center gap-4 py-3">
            <Avatar name={p.full_name} src={p.photo_path ? photos.get(p.photo_path) : null} placeholder={p.is_placeholder} />
            <div className="min-w-0">
              <p className={`font-semibold leading-snug ${p.is_placeholder ? "text-ink-muted" : ""}`}>
                {name}
                {p.id === me && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 align-middle text-xs text-white">You</span>}
              </p>
              {!p.is_placeholder && (p.title || p.organisation) && (
                <p className="text-[0.95rem] leading-snug text-ink-muted">
                  {[p.title, p.organisation].filter(Boolean).join(", ")}
                </p>
              )}
              <p className="text-sm font-semibold text-brand-strong">{roleLabel(m.role)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
