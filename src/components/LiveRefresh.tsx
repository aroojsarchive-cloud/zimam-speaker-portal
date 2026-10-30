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
    const channel = supabase.channel("programme");
    for (const table of ["events", "tracks", "sessions", "assignments", "concept_notes", "people", "slide_submissions", "track_hosts"])
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    channel.subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [router]);
  return null;
}
