import { eventConfig } from "@/config/event";

// All times are stored in UTC and always shown in the event's timezone,
// whatever timezone the viewer's phone is in.
const tz = eventConfig.timezone;

const timeFmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false });
const dayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short" });
const longDayFmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long", day: "numeric", month: "long" });
const dateKeyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
const stampFmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });

export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatDay = (iso: string) => dayFmt.format(new Date(iso));
export const formatLongDay = (iso: string) => longDayFmt.format(new Date(iso));
export const formatRange = (start: string, end: string) => `${formatTime(start)}–${formatTime(end)}`;
export const formatStamp = (iso: string) => stampFmt.format(new Date(iso));
/** YYYY-MM-DD in the event timezone. */
export const eventDateKey = (iso: string | Date) => dateKeyFmt.format(new Date(iso));
export const minutesBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);

/** Where a session will actually start/end given its room's delay (minutes). */
export const shifted = (iso: string, lateMin: number) => new Date(new Date(iso).getTime() + lateMin * 60000).toISOString();

/** True while a session (shifted by its room's delay) hasn't finished yet. */
/** The current moment, for Now/Next markers (kept out of components for render purity). */
export const nowMs = () => Date.now();
export const notFinished = (endIso: string, lateMin = 0) => new Date(shifted(endIso, lateMin)).getTime() > Date.now();

/**
 * Today's date at the event. DEMO_TODAY (e.g. 2026-11-04) lets the "on the day"
 * features be previewed in development; it is ignored in production.
 */
export function eventToday(): string {
  if (process.env.NODE_ENV !== "production" && process.env.DEMO_TODAY) return process.env.DEMO_TODAY;
  return eventDateKey(new Date());
}
