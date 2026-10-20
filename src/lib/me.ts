import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { eventConfig } from "@/config/event";
import { createClient } from "@/lib/supabase/server";

export type Me = {
  userId: string;
  personId: string;
  eventId: string;
  fullName: string;
  salutation: string | null;
  appRole: "producer" | "viewer" | "participant";
};

/** The signed-in person at this event. Redirects to /login if there isn't one. */
export const getMe = cache(async (): Promise<Me> => {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect("/login");

  const { data, error } = await supabase
    .from("people")
    .select("id, event_id, full_name, salutation, app_role, events!inner(slug)")
    .eq("auth_user_id", userId)
    .eq("events.slug", eventConfig.slug)
    .maybeSingle();
  if (error) throw new Error(`Could not load your profile: ${error.message}`);
  if (!data) redirect("/login?reason=not-linked");

  return {
    userId,
    personId: data.id,
    eventId: data.event_id,
    fullName: data.full_name,
    salutation: data.salutation,
    appRole: data.app_role,
  };
});

export const firstName = (fullName: string) => fullName.split(" ")[0];
