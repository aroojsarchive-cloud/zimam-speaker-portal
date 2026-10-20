import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { eventConfig } from "@/config/event";
import { createAdminClient } from "@/lib/supabase/admin";

/** Public event info (producer contact) for pages shown before sign-in. */
export const getPublicEventInfo = cache(async () => {
  await connection();
  const { data } = await createAdminClient()
    .from("events")
    .select("id, name, producer_name, producer_phone, producer_whatsapp")
    .eq("slug", eventConfig.slug)
    .maybeSingle();
  const f = eventConfig.fallbackContact;
  return {
    id: data?.id ?? null,
    contactName: data?.producer_name ?? f.name,
    phone: data?.producer_phone ?? f.phone,
    whatsapp: data?.producer_whatsapp ?? f.whatsapp,
  };
});
