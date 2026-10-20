import "server-only";
import { createClient } from "@/lib/supabase/server";

// Everything here runs as the signed-in user, so row-level security decides
// what comes back: drafts, other people's contact details and producer notes never do.

export type TrackInfo = { id: string; name: string; room: string | null; colour: string | null; strapline: string | null };
export type SessionInfo = {
  id: string;
  title: string;
  label: string | null;
  block_label: string | null;
  format: string;
  session_type: "speaking" | "non_speaking";
  start_time: string;
  end_time: string;
  sequence: number;
  description: string | null;
  updated_at: string;
};
export type PersonCard = {
  id: string;
  salutation: string | null;
  full_name: string;
  title: string | null;
  organisation: string | null;
  country: string | null;
  photo_path: string | null;
  is_placeholder: boolean;
};
export type KeyQuestion = { text: string; person_id: string | null };
export type ConceptNote = {
  summary: string | null;
  objectives: string | null;
  key_questions: KeyQuestion[];
  format_notes: string | null;
  run_of_show: string | null;
  file_path: string | null;
  file_name: string | null;
  version: number;
  updated_at: string;
};

export async function getEventInfo(eventId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select("name, venue, timezone, producer_name, producer_phone, producer_whatsapp, running_late_minutes, running_late_updated_at")
    .eq("id", eventId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function getMyProfile(personId: string) {
  const supabase = await createClient();
  const [{ data: person, error }, { data: priv }] = await Promise.all([
    supabase
      .from("people")
      .select("id, salutation, full_name, title, organisation, country, photo_path, details_status, guidelines_ack_at")
      .eq("id", personId)
      .single(),
    supabase.from("people_private").select("change_request_note, last_seen_changes_at").eq("person_id", personId).maybeSingle(),
  ]);
  if (error) throw new Error(error.message);
  return { ...person, change_request_note: priv?.change_request_note ?? null, last_seen_changes_at: priv?.last_seen_changes_at ?? null };
}

export type Engagement = {
  id: string;
  role: string;
  status: string;
  checked_in_at: string | null;
  reviewed_at: string | null;
  no_slides: boolean;
  presents: boolean;
  session: SessionInfo & { track: TrackInfo; notes: { kind: string; updated_at: string }[] };
};

export async function getMyEngagements(personId: string): Promise<Engagement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .select(
      "id, role, status, checked_in_at, reviewed_at, no_slides, presents, session:sessions!inner(id, title, label, block_label, format, session_type, start_time, end_time, sequence, description, updated_at, track:tracks!inner(id, name, room, colour, strapline), notes:concept_notes(kind, updated_at))",
    )
    .eq("person_id", personId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as Engagement[]).sort((a, b) => a.session.start_time.localeCompare(b.session.start_time));
}

export type StageMember = { role: string; status: string; person: PersonCard };

export async function getSessionDetail(sessionId: string) {
  const supabase = await createClient();
  const { data: session, error } = await supabase
    .from("sessions")
    .select(
      "id, title, label, block_label, format, session_type, start_time, end_time, sequence, description, updated_at, track:tracks!inner(id, name, room, colour, strapline)",
    )
    .eq("id", sessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!session) return null;
  const s = session as unknown as SessionInfo & { track: TrackInfo };

  const [trackSessions, stage, note] = await Promise.all([
    supabase
      .from("sessions")
      .select("id, title, label, block_label, format, session_type, start_time, end_time, sequence, description, updated_at")
      .eq("track_id", s.track.id)
      .order("sequence"),
    supabase
      .from("assignments")
      .select("role, status, sort_order, person:people!inner(id, salutation, full_name, title, organisation, country, photo_path, is_placeholder)")
      .eq("session_id", sessionId)
      .order("sort_order"),
    supabase
      .from("concept_notes")
      .select("summary, objectives, key_questions, format_notes, run_of_show, file_path, file_name, version, updated_at")
      .eq("session_id", sessionId)
      .eq("kind", "published")
      .maybeSingle(),
  ]);

  const roleOrder = ["moderator", "chair", "co_chair", "host", "mc", "keynote", "speaker", "panelist", "jury"];
  const members = ((stage.data ?? []) as unknown as StageMember[]).sort(
    (a, b) =>
      roleOrder.indexOf(a.role) - roleOrder.indexOf(b.role) ||
      Number(a.person.is_placeholder) - Number(b.person.is_placeholder),
  );

  return {
    session: s,
    trackSessions: (trackSessions.data ?? []) as SessionInfo[],
    stage: members,
    note: (note.data as ConceptNote | null) ?? null,
  };
}

export type AgendaDay = {
  id: string;
  date: string;
  label: string;
  tracks: (TrackInfo & {
    sort_order: number;
    short_name: string | null;
    sessions: (SessionInfo & {
      assignments: {
        role: string;
        person_id: string;
        sort_order: number;
        person: Pick<PersonCard, "salutation" | "full_name" | "is_placeholder" | "title" | "organisation" | "photo_path">;
      }[];
    })[];
  })[];
};

export async function getAgenda(eventId: string): Promise<AgendaDay[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("days")
    .select(
      "id, date, label, tracks(id, name, short_name, room, colour, strapline, sort_order, sessions(id, title, label, block_label, format, session_type, start_time, end_time, sequence, description, updated_at, assignments(role, person_id, sort_order, person:people(salutation, full_name, is_placeholder, title, organisation, photo_path))))",
    )
    .eq("event_id", eventId)
    .order("date");
  if (error) throw new Error(error.message);
  const days = (data ?? []) as unknown as AgendaDay[];
  for (const d of days) {
    d.tracks.sort((a, b) => a.sort_order - b.sort_order);
    for (const t of d.tracks) t.sessions.sort((a, b) => a.sequence - b.sequence);
    d.tracks = d.tracks.filter((t) => t.sessions.length > 0);
  }
  return days;
}

/** Short-lived signed URLs for private photos (and brief files). */
export async function signedUrls(bucket: "photos" | "briefs" | "slides", paths: (string | null)[], expiresIn = 3600) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  if (!unique.length) return new Map<string, string>();
  const supabase = await createClient();
  const { data } = await supabase.storage.from(bucket).createSignedUrls(unique, expiresIn);
  return new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string]));
}
