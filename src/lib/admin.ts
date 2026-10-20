import "server-only";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/me";

/** Producer pages: everyone else goes back to their own portal. RLS enforces this too. */
export async function requireProducer() {
  const me = await getMe();
  if (me.appRole !== "producer") redirect("/");
  return me;
}
