"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireProducer } from "@/lib/admin";
import { createClient } from "@/lib/supabase/server";

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
});
export type PersonInput = z.input<typeof PersonInput>;

function friendly(message: string) {
  return /duplicate|unique/i.test(message) ? "Someone else already has that email." : "Couldn't save. Please try again.";
}

export async function savePerson(personId: string, input: PersonInput): Promise<Result> {
  await requireProducer();
  const parsed = PersonInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { email, ...profile } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("people").update(profile).eq("id", personId);
  if (error) return { ok: false, message: friendly(error.message) };
  const { error: e2 } = await supabase.from("people_private").update({ email }).eq("person_id", personId);
  if (e2) return { ok: false, message: friendly(e2.message) };
  revalidatePath("/admin/people");
  return { ok: true };
}

export async function addPerson(input: PersonInput): Promise<Result> {
  const me = await requireProducer();
  const parsed = PersonInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0].message };
  const { email, ...profile } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.from("people").insert({ ...profile, event_id: me.eventId }).select("id").single();
  if (error) return { ok: false, message: friendly(error.message) };
  const { error: e2 } = await supabase.from("people_private").insert({ person_id: data.id, email });
  if (e2) {
    await supabase.from("people").delete().eq("id", data.id);
    return { ok: false, message: friendly(e2.message) };
  }
  revalidatePath("/admin/people");
  return { ok: true };
}

/** Invalidates someone's personal link (e.g. it was forwarded) and issues a new one. */
export async function resetInviteLink(personId: string): Promise<Result> {
  await requireProducer();
  const token = crypto.randomUUID().replace(/-/g, "");
  const { error } = await (await createClient()).from("people_private").update({ invite_token: token }).eq("person_id", personId);
  if (error) return { ok: false, message: "Couldn't reset the link." };
  revalidatePath("/admin/people");
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
  revalidatePath("/admin/people");
  revalidatePath("/admin");
  return { ok: true };
}
