"use client";
import { useEffect, useState } from "react";
import { formatStamp } from "@/lib/time";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
];

function relative(iso: string) {
  let diff = (new Date(iso).getTime() - Date.now()) / 60000;
  if (Math.abs(diff) < 1) return "just now";
  for (const [unit, size] of STEPS) {
    if (Math.abs(diff) < size) return rtf.format(Math.round(diff), unit);
    diff /= size;
  }
  return null;
}

/** "2 hours ago", falling back to a date for anything older than a week. */
export function RelativeTime({ iso }: { iso: string }) {
  const [text, setText] = useState(formatStamp(iso));
  useEffect(() => {
    const tick = () => setText(relative(iso) ?? formatStamp(iso));
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [iso]);
  return <time dateTime={iso}>{text}</time>;
}
