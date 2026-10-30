"use server";
import { revalidatePath } from "next/cache";
import { fromZonedTime } from "date-fns-tz";
import { z } from "zod";
import { eventConfig } from "@/config/event";
import { requireProducer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; id?: string } | { ok: false; message: string };

const FORMATS = ["keynote", "panel", "fireside", "lecture", "opening", "closing", "break", "contest", "award", "workshop", "briefing", "pitches", "judging", "other"] as const;
const ROLES = ["moderator", "panelist", "keynote", "speaker", "mc", "jury", "chair", "co_chair", "host"] as const;
const STATUSES = ["confirmed", "tentative", "invited", "tbc"] as const;
const Time = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");

const at = (date: string, time: string) => fromZonedTime(`${date}T${time}:00`, eventConfig.timezone).toISOString();

function done(): Result {
  revalidatePath("/admin/programme");
  revalidatePath("/agenda");
  revalidatePath("/");
  return { ok: true };
}

/** Keeps the running order (sequence) matching start times after any time change. */
async function resequence(trackId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("sessions").select("id, sequence").eq("track_id", trackId).order("start_time").order("sequence");
  for (const [i, s] of (data ?? []).entries())
    if (s.sequence !== i + 1) await supabase.from("sessions").update({ sequence: i + 1 }).eq("id", s.id);
}

const SessionInput = z.object({
  date: z.string(),
  start: Time,
  end: Time,
  label: z.string().trim().max(120),
  title: z.string().trim().min(2, "Title is required").max(300),
  format: z.enum(FORMATS),
  session_type: z.enum(["speaking", "non_speaking"]),
  status: z.enum(["draft", "published"]),
  description: z.string().trim().max(3000),
});
export type SessionInput = z.infer<typeof SessionInput>;

export async function saveSession(id: string, input: SessionInput): Promise<Result> {
  await requireProducer();
  const parsed = SessionInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const v = parsed.data;
  if (v.end <= v.start) return { ok: false, message: "End time must be after the start time." };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .update({
      start_time: at(v.date, v.start),
      end_time: at(v.date, v.end),
      label: v.label || null,
      title: v.title,
      format: v.format,
      session_type: v.session_type,
      status: v.status,
      published_at: v.status === "published" ? new Date().toISOString() : null,
      description: v.description || null,
    })
    .eq("id", id)
    .select("track_id")
    .single();
  if (error) return { ok: false, message: "Couldn't save the session." };
  await resequence(data.track_id);
  return done();
}

export async function addSession(trackId: string, date: string, start: string): Promise<Result> {
  await requireProducer();
  const [h, m] = start.split(":").map(Number);
  const endMin = h * 60 + m + 15;
  const end = `${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .insert({ track_id: trackId, start_time: at(date, start), end_time: at(date, end), sequence: 999, title: "New session", format: "other", status: "draft" })
    .select("id")
    .single();
  if (error) return { ok: false, message: "Couldn't add a session." };
  await resequence(trackId);
  const r = done();
  return { ...r, id: data.id } as Result;
}

export async function deleteSession(id: string): Promise<Result> {
  await requireProducer();
  const supabase = await createClient();
  const { data: s } = await supabase.from("sessions").select("track_id").eq("id", id).single();
  // Placeholder people only exist for this slot: remove them with it.
  const { data: ph } = await supabase.from("assignments").select("person:people!inner(id, is_placeholder)").eq("session_id", id);
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  if (error) return { ok: false, message: "Couldn't delete the session." };
  const placeholderIds = ((ph ?? []) as unknown as { person: { id: string; is_placeholder: boolean } }[])
    .filter((a) => a.person.is_placeholder)
    .map((a) => a.person.id);
  if (placeholderIds.length) await supabase.from("people").delete().in("id", placeholderIds);
  if (s) await resequence(s.track_id);
  return done();
}

const TrackInput = z.object({
  name: z.string().trim().min(2).max(200),
  short_name: z.string().trim().max(40),
  room: z.string().trim().max(60),
  strapline: z.string().trim().max(300),
});
export async function saveTrack(id: string, input: z.infer<typeof TrackInput>): Promise<Result> {
  await requireProducer();
  const parsed = TrackInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Name is required." };
  const v = parsed.data;
  const { error } = await (await createClient())
    .from("tracks")
    .update({ name: v.name, short_name: v.short_name || null, room: v.room || null, strapline: v.strapline || null })
    .eq("id", id);
  if (error) return { ok: false, message: "Couldn't save." };
  return done();
}

const AssignInput = z.object({
  personId: z.string().uuid().nullable(),
  tbcLabel: z.string().trim().max(150),
  role: z.enum(ROLES),
});
/** Adds a real person, or a "TBC" placeholder slot, to a session. */
export async function addToSession(sessionId: string, input: z.infer<typeof AssignInput>): Promise<Result> {
  const me = await requireProducer();
  const parsed = AssignInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pick a person or type a TBC label." };
  const v = parsed.data;
  const supabase = await createClient();
  let personId = v.personId;
  if (!personId) {
    if (!v.tbcLabel) return { ok: false, message: "Pick a person or type a TBC label." };
    const { data: ph, error } = await supabase
      .from("people")
      .insert({ event_id: me.eventId, full_name: v.tbcLabel, is_placeholder: true })
      .select("id")
      .single();
    if (error) return { ok: false, message: "Couldn't add the TBC slot." };
    await supabase.from("people_private").insert({ person_id: ph.id });
    personId = ph.id;
  }
  const { data: s } = await supabase.from("sessions").select("format, session_type").eq("id", sessionId).single();
  const presents =
    s?.session_type === "speaking" && ["keynote", "speaker"].includes(v.role) && ["keynote", "lecture", "workshop"].includes(s?.format ?? "");
  const { error } = await supabase.from("assignments").insert({
    person_id: personId,
    session_id: sessionId,
    role: v.role,
    status: v.personId ? "invited" : "tbc",
    sort_order: v.role === "moderator" ? -1 : 50,
    presents,
  });
  if (error) return { ok: false, message: /duplicate|unique/i.test(error.message) ? "They already have that role here." : "Couldn't add." };
  return done();
}

const AssignmentUpdate = z.object({ role: z.enum(ROLES), status: z.enum(STATUSES), presents: z.boolean() });
export async function updateAssignment(id: string, input: z.infer<typeof AssignmentUpdate>): Promise<Result> {
  await requireProducer();
  const parsed = AssignmentUpdate.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid." };
  const { error } = await (await createClient())
    .from("assignments")
    .update({ ...parsed.data, sort_order: parsed.data.role === "moderator" ? -1 : 50 })
    .eq("id", id);
  if (error) return { ok: false, message: "Couldn't update." };
  return done();
}

export async function removeFromSession(id: string): Promise<Result> {
  await requireProducer();
  const supabase = await createClient();
  const { data } = await supabase.from("assignments").select("person:people!inner(id, is_placeholder)").eq("id", id).single();
  const { error } = await supabase.from("assignments").delete().eq("id", id);
  if (error) return { ok: false, message: "Couldn't remove." };
  const person = (data as unknown as { person: { id: string; is_placeholder: boolean } } | null)?.person;
  if (person?.is_placeholder) await supabase.from("people").delete().eq("id", person.id);
  return done();
}

const HostInput = z.object({ personId: z.string().uuid(), role: z.enum(["mc", "chair", "co_chair"]) });
/** MCs and chairs host a whole programme; they get a run sheet for it. */
export async function addHost(trackId: string, input: z.infer<typeof HostInput>): Promise<Result> {
  await requireProducer();
  const parsed = HostInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pick someone from the list." };
  const supabase = await createClient();
  const { count } = await supabase.from("track_hosts").select("id", { count: "exact", head: true }).eq("track_id", trackId);
  const { error } = await supabase
    .from("track_hosts")
    .insert({ track_id: trackId, person_id: parsed.data.personId, role: parsed.data.role, sort_order: count ?? 0 });
  if (error) return { ok: false, message: /duplicate|unique/i.test(error.message) ? "They're already hosting this." : "Couldn't add." };
  return done();
}

export async function removeHost(id: string): Promise<Result> {
  await requireProducer();
  const { error } = await (await createClient()).from("track_hosts").delete().eq("id", id);
  if (error) return { ok: false, message: "Couldn't remove." };
  return done();
}
