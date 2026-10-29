"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProducer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";
import { whatsappNumber } from "@/lib/phone";

type Result = { ok: true } | { ok: false; message: string };

const PersonInput = z.object({
  salutation: z.string().trim().max(20).optional().transform((v) => v || null),
  full_name: z.string().trim().min(2, "Name is required").max(120),
  title: z.string().trim().max(200).optional().transform((v) => v || null),
  organisation: z.string().trim().max(200).optional().transform((v) => v || null),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || z.string().email().safeParse(v).success, "That email doesn't look right"),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || whatsappNumber(v) !== null, "Add the full number with country code, e.g. +971 50 123 4567")
    .transform((v) => (v ? `+${whatsappNumber(v)}` : null)),
});
export type PersonInput = z.input<typeof PersonInput>;

function friendly(message: string) {
  return /duplicate|unique/i.test(message) ? "Someone else already has that email." : "Couldn't save. Please try again.";
}

export async function savePerson(personId: string, input: PersonInput): Promise<Result> {
  await requireProducer();
  const parsed = PersonInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { email, phone, ...profile } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("people").update(profile).eq("id", personId);
  if (error) return { ok: false, message: friendly(error.message) };
  // Forms without the number field leave the stored number alone.
  const { error: e2 } = await supabase
    .from("people_private")
    .update(input.phone === undefined ? { email } : { email, phone })
    .eq("person_id", personId);
  if (e2) return { ok: false, message: friendly(e2.message) };
  revalidatePath("/admin");
  return { ok: true };
}

export async function addPerson(input: PersonInput): Promise<Result> {
  const me = await requireProducer();
  const parsed = PersonInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { email, phone, ...profile } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("people").insert({ ...profile, event_id: me.eventId }).select("id").single();
  if (error) return { ok: false, message: friendly(error.message) };
  const { error: e2 } = await supabase.from("people_private").insert({ person_id: data.id, email, phone });
  if (e2) {
    await supabase.from("people").delete().eq("id", data.id);
    return { ok: false, message: friendly(e2.message) };
  }
  revalidatePath("/admin");
  return { ok: true };
}

/** Invalidates someone's personal link (e.g. it was forwarded) and issues a new one. */
export async function resetInviteLink(personId: string): Promise<Result> {
  await requireProducer();
  const token = crypto.randomUUID().replace(/-/g, "");
  const { error } = await (await createClient()).from("people_private").update({ invite_token: token }).eq("person_id", personId);
  if (error) return { ok: false, message: "Couldn't reset the link." };
  revalidatePath("/admin");
  return { ok: true };
}

/** Producer ticks someone in (or undoes it) from the live view. */
export async function setCheckedIn(assignmentId: string, here: boolean): Promise<Result> {
  await requireProducer();
  const { error } = await (await createClient())
    .from("assignments")
    .update({ checked_in_at: here ? new Date().toISOString() : null })
    .eq("id", assignmentId);
  if (error) return { ok: false, message: "Couldn't update check-in." };
  revalidatePath("/admin/live");
  return { ok: true };
}

/** Whether this person presents slides in this session (drives their "Upload your presentation" step). */
export async function setPresents(assignmentId: string, presents: boolean): Promise<Result> {
  await requireProducer();
  const { error } = await (await createClient()).from("assignments").update({ presents }).eq("id", assignmentId);
  if (error) return { ok: false, message: "Couldn't update." };
  revalidatePath("/admin");
  revalidatePath("/admin");
  return { ok: true };
}

/** Producer sets how late a room is running (0 = on time). Speakers in that room see it straight away. */
export async function setRoomDelay(trackId: string, minutes: number): Promise<Result> {
  await requireProducer();
  const m = Math.max(0, Math.min(180, Math.round(minutes)));
  const { error } = await (await createClient())
    .from("tracks")
    .update({ running_late_minutes: m, running_late_updated_at: new Date().toISOString() })
    .eq("id", trackId);
  if (error) return { ok: false, message: "Couldn't update." };
  revalidatePath("/admin/live");
  revalidatePath("/");
  return { ok: true };
}
