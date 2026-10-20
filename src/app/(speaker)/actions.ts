"use server";
import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; message: string };

export async function confirmMyDetails(): Promise<Result> {
  const me = await getMe();
  const { error } = await (await createClient()).rpc("confirm_details", { p_person: me.personId });
  if (error) return { ok: false, message: "We couldn't save that. Please try again." };
  revalidatePath("/");
  return { ok: true };
}

export async function flagMyDetails(note: string): Promise<Result> {
  if (!note.trim()) return { ok: false, message: "Tell us what needs changing." };
  const me = await getMe();
  const { error } = await (await createClient()).rpc("request_details_change", { p_person: me.personId, p_note: note });
  if (error) return { ok: false, message: "We couldn't send that. Please try again." };
  revalidatePath("/");
  return { ok: true };
}

export async function saveMyPhoto(path: string): Promise<Result> {
  const me = await getMe();
  const { error } = await (await createClient()).rpc("set_my_photo", { p_person: me.personId, p_path: path });
  if (error) return { ok: false, message: "We couldn't save your photo. Please try again." };
  revalidatePath("/");
  return { ok: true };
}

export async function markChangesSeen(): Promise<void> {
  const me = await getMe();
  await (await createClient()).rpc("mark_changes_seen", { p_person: me.personId });
}

export async function checkIn(assignmentId: string, sessionId: string): Promise<Result> {
  const { error } = await (await createClient()).rpc("check_in", { p_assignment: assignmentId });
  if (error) return { ok: false, message: "Check-in opens on the day of your session." };
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function markSlidesSent(assignmentIds: string[], sessionId: string, sent: boolean): Promise<Result> {
  const supabase = await createClient();
  for (const id of assignmentIds) {
    const { error } = await supabase.rpc("mark_slides_sent", { p_assignment: id, p_sent: sent });
    if (error) return { ok: false, message: "We couldn't save that. Please try again." };
  }
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function markReviewed(assignmentIds: string[], sessionId: string): Promise<Result> {
  const supabase = await createClient();
  for (const id of assignmentIds) {
    const { error } = await supabase.rpc("mark_session_reviewed", { p_assignment: id });
    if (error) return { ok: false, message: "We couldn't save that. Please try again." };
  }
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function setNoSlides(assignmentIds: string[], sessionId: string, value: boolean): Promise<Result> {
  const supabase = await createClient();
  for (const id of assignmentIds) {
    const { error } = await supabase.rpc("set_no_slides", { p_assignment: id, p_value: value });
    if (error) return { ok: false, message: "We couldn't save that. Please try again." };
  }
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  return { ok: true };
}

export async function acknowledgeGuidelines(): Promise<Result> {
  const me = await getMe();
  const { error } = await (await createClient()).rpc("acknowledge_guidelines", { p_person: me.personId });
  if (error) return { ok: false, message: "We couldn't save that. Please try again." };
  revalidatePath("/guidelines");
  revalidatePath("/");
  return { ok: true };
}
