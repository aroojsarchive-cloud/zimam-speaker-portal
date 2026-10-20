import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getMe } from "@/lib/me";
import { createClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/labels";
import { BriefEditor } from "@/components/BriefEditor";
import type { KeyQuestion } from "@/lib/speaker-data";

export const metadata: Metadata = { title: "Edit brief" };

type Note = {
  kind: string;
  summary: string | null;
  objectives: string | null;
  key_questions: KeyQuestion[];
  format_notes: string | null;
  file_path: string | null;
  file_name: string | null;
  version: number;
};

async function Editor({ params }: { params: PageProps<"/sessions/[id]/brief">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await getMe();
  const supabase = await createClient();
  const [{ data: session }, { data: stage }, { data: notes }] = await Promise.all([
    supabase.from("sessions").select("id, title").eq("id", id).maybeSingle(),
    supabase.from("assignments").select("role, person:people!inner(id, salutation, full_name, is_placeholder)").eq("session_id", id),
    supabase.from("concept_notes").select("kind, summary, objectives, key_questions, format_notes, file_path, file_name, version").eq("session_id", id),
  ]);
  type Member = { role: string; person: { id: string; salutation: string | null; full_name: string; is_placeholder: boolean } };
  const members = (stage ?? []) as unknown as Member[];
  const isModerator = members.some((m) => m.role === "moderator" && m.person.id === me.personId);
  if (!session || !(isModerator || me.appRole === "producer")) notFound();

  const all = (notes ?? []) as Note[];
  const draft = all.find((n) => n.kind === "draft") ?? all.find((n) => n.kind === "published");
  const published = all.find((n) => n.kind === "published");
  const named = members.filter((m) => !m.person.is_placeholder);
  const panel = [...new Map(named.filter((m) => m.person.id !== me.personId).map((m) => [m.person.id, { id: m.person.id, name: displayName(m.person), role: m.role }])).values()];

  return (
    <>
      <p className="text-sm text-ink-muted">Session brief</p>
      <h1 className="mt-1 font-display text-[1.6rem] font-semibold leading-tight">{session.title}</h1>
      <div className="mt-5">
        <BriefEditor
          sessionId={id}
          me={me.personId}
          panel={panel}
          publishedVersion={published?.version ?? null}
          audience={new Set(named.map((m) => m.person.id)).size}
          initial={{
            summary: draft?.summary ?? "",
            objectives: draft?.objectives ?? "",
            key_questions: draft?.key_questions?.length ? draft.key_questions : [{ text: "", person_id: null }],
            format_notes: draft?.format_notes ?? "",
            file_path: draft?.file_path ?? null,
            file_name: draft?.file_name ?? null,
          }}
        />
      </div>
    </>
  );
}

export default function BriefPage({ params }: PageProps<"/sessions/[id]/brief">) {
  return (
    <main className="mx-auto w-full max-w-md px-4 pb-6 pt-4">
      <BackLink params={params} />
      <Suspense fallback={<div aria-busy="true" className="h-96 animate-pulse rounded-3xl bg-surface" />}>
        <Editor params={params} />
      </Suspense>
    </main>
  );
}

async function BackLinkInner({ params }: { params: PageProps<"/sessions/[id]/brief">["params"] }) {
  const { id } = await params;
  return (
    <Link href={`/sessions/${id}`} className="mb-3 inline-flex h-11 items-center text-[0.95rem] font-semibold text-ink-muted hover:text-ink">
      ‹ Back to session
    </Link>
  );
}
function BackLink({ params }: { params: PageProps<"/sessions/[id]/brief">["params"] }) {
  return (
    <Suspense fallback={<span className="mb-3 inline-flex h-11" />}>
      <BackLinkInner params={params} />
    </Suspense>
  );
}
