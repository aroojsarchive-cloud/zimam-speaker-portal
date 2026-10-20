"use client";
import { useEffect } from "react";
import { markChangesSeen } from "@/app/(speaker)/actions";

/** Once the page has been shown, record that the speaker has seen the latest changes. */
export function MarkSeen() {
  useEffect(() => {
    const t = setTimeout(() => void markChangesSeen(), 1500);
    return () => clearTimeout(t);
  }, []);
  return null;
}
