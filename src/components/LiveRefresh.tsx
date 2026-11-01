"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Re-renders the page when the producer edits the programme, so nobody holds a stale version. */
export function LiveRefresh() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };
    const channel = supabase.channel(`programme-${crypto.randomUUID()}`);
    for (const table of ["events", "tracks", "sessions", "assignments", "concept_notes", "people", "slide_submissions", "track_hosts"])
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    // Join with the speaker's own sign-in: as an anonymous visitor the database sends nothing.
    let cancelled = false;
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      if (data.session) await supabase.realtime.setAuth(data.session.access_token);
      channel.subscribe();
    });
    // A phone that slept has missed changes and may have lost the connection: catch up on wake.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", refresh);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", refresh);
      supabase.removeChannel(channel);
    };
  }, [router]);
  return null;
}
