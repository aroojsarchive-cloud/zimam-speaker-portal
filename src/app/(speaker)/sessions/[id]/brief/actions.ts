"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; version?: number } | { ok: false; message: string };

const Draft = z.object({
  summary: z.string().max(4000),
  objectives: z.string().max(4000),
  questions_text: z.string().max(10000),
  format_notes: z.string().max(4000),
  file_path: z.string().nullable(),
  file_name: z.string().nullable(),
});
export type DraftInput = z.infer<typeof Draft>;

/** Autosave: row-level security only lets this session's moderator (or a producer) write the draft. */
export async function saveDraft(sessionId: string, input: DraftInput): Promise<Result> {
  const parsed = Draft.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Some fields are too long." };
  const d = parsed.data;
  const supabase = await createClient();
  const row = {
    summary: d.summary.trim() || null,
    objectives: d.objectives.trim() || null,
    questions_text: d.questions_text.trim() || null,
    format_notes: d.format_notes.trim() || null,
    file_path: d.file_path,
    file_name: d.file_name,
    updated_at: new Date().toISOString(),
  };
  const { data: existing } = await supabase.from("concept_notes").select("id").eq("session_id", sessionId).eq("kind", "draft").maybeSingle();
  const { error } = existing
    ? await supabase.from("concept_notes").update(row).eq("id", existing.id)
    : await supabase.from("concept_notes").insert({ ...row, session_id: sessionId, kind: "draft" });
  if (error) return { ok: false, message: "Couldn't save your draft. Check your connection." };
  return { ok: true };
}

export async function publishBrief(sessionId: string, input: DraftInput): Promise<Result> {
  const saved = await saveDraft(sessionId, input);
  if (!saved.ok) return saved;
  const { data, error } = await (await createClient()).rpc("publish_brief", { p_session: sessionId });
  if (error) return { ok: false, message: "Couldn't publish. Please try again." };
  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/");
  return { ok: true, version: data as number };
}
