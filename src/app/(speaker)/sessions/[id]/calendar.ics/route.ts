import { eventConfig as ev } from "@/config/event";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

export async function GET(_req: Request, ctx: RouteContext<"/sessions/[id]/calendar.ics">) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: s } = await supabase
    .from("sessions")
    .select("id, title, start_time, end_time, updated_at, track:tracks!inner(name, room)")
    .eq("id", id)
    .maybeSingle();
  if (!s) return new Response("Not found", { status: 404 });
  const track = s.track as unknown as { name: string; room: string | null };
  const url = `${env.siteUrl()}/sessions/${s.id}`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${ev.shortName}//Speaker Portal//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${s.id}@${new URL(env.siteUrl()).host}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `LAST-MODIFIED:${stamp(s.updated_at)}`,
    `DTSTART:${stamp(s.start_time)}`,
    `DTEND:${stamp(s.end_time)}`,
    `SUMMARY:${esc(`${ev.shortName}: ${s.title}`)}`,
    `LOCATION:${esc([track.room, ev.venue].filter(Boolean).join(", "))}`,
    `DESCRIPTION:${esc(`${track.name}\n\nLatest details, always up to date: ${url}`)}`,
    `URL:${url}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(s.title)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="zimam-session.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
