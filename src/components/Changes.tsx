import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { buildSnapshot, diffSnapshots, type Snapshot } from "@/lib/changes";
import { ChangesDialog, RememberProgramme } from "@/components/ChangesDialog";

export async function Changes() {
  const me = await getMe();
  if (me.appRole === "producer") return null;
  const [{ data }, now] = await Promise.all([
    (await createClient()).from("people_private").select("seen_snapshot").eq("person_id", me.personId).maybeSingle(),
    buildSnapshot(me.personId),
  ]);
  const before = (data?.seen_snapshot ?? null) as Snapshot | null;
  if (!before) return <RememberProgramme />;
  const notices = diffSnapshots(before, now);
  return notices.length ? <ChangesDialog notices={notices} /> : null;
}
