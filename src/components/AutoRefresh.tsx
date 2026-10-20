"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Re-renders every `seconds` so "now" and "next" keep moving on screens left open. */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
