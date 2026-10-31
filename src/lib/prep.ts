import { eventDateKey, formatDay, formatTime } from "@/lib/time";

// Preparation steps, shared by the speaker's checklist and the producer's tracker
// so both always agree on what "done" means.

export const ARRIVE_BEFORE_MIN = 20;

export type PrepEngagement = {
  assignmentId: string;
  role: string;
  sessionId: string;
  sessionTitle: string;
  speaking: boolean;
  start: string;
  room: string | null;
  reviewedAt: string | null;
  noSlides: boolean;
  /** The speaker has told us they emailed their slides. */
  hasSlides: boolean;
  /** Set from the programme: only presenters are asked for slides. */
  presents: boolean;
  briefPublished: boolean;
  checkedInAt: string | null;
};

/** A programme the person hosts (MC / co-chair): they must be there before its first session. */
export type PrepHosting = { trackId: string; room: string | null; start: string; checkedInAt: string | null };

export type StepKey = "details" | "guidelines" | "session" | "slides" | "brief" | "checkin";
export type Step = { key: StepKey; label: string; detail: string; done: boolean; href: string | null };

export const needsSlides = (e: PrepEngagement) => e.speaking && e.presents;
export const arriveBy = (start: string) => new Date(new Date(start).getTime() - ARRIVE_BEFORE_MIN * 60000).toISOString();

export function prepSteps(opts: {
  detailsConfirmed: boolean;
  guidelinesAck: boolean;
  engagements: PrepEngagement[];
  hosting?: PrepHosting[];
}): Step[] {
  const speaking = opts.engagements.filter((e) => e.speaking);
  // Name and details are confirmed on the profile card right above the checklist, so not repeated here.
  const steps: Step[] = [];

  if (speaking.length)
    steps.push({
      key: "guidelines",
      label: "Read the speaker guidelines",
      detail: opts.guidelinesAck ? "Thank you." : "Slides, timing and the stage cues. Two minutes to read.",
      done: opts.guidelinesAck,
      href: "/guidelines",
    });

  if (speaking.length) {
    const todo = speaking.filter((e) => !e.reviewedAt);
    steps.push({
      key: "session",
      label: speaking.length > 1 ? "Check your sessions" : "Check your session",
      detail: todo.length
        ? "Read the running order and who you're on stage with."
        : speaking.length > 1 ? `All ${speaking.length} sessions checked.` : "Done, thank you.",
      done: todo.length === 0,
      href: todo[0] ? `/sessions/${todo[0].sessionId}#review` : null,
    });
  }

  const slideables = opts.engagements.filter(needsSlides);
  if (slideables.length) {
    const todo = slideables.filter((e) => !e.hasSlides && !e.noSlides);
    steps.push({
      key: "slides",
      label: "Send your presentation",
      detail: todo.length ? "Email your slides to us, or tell us you're not using slides." : "Done, thank you.",
      done: todo.length === 0,
      href: todo[0] ? `/sessions/${todo[0].sessionId}#slides-h` : null,
    });
  }

  const moderated = opts.engagements.filter((e) => e.role === "moderator");
  if (moderated.length) {
    const todo = moderated.filter((e) => !e.briefPublished);
    steps.push({
      key: "brief",
      label: moderated.length > 1 ? "Submit your session briefs" : "Submit your session brief",
      detail: todo.length ? "Write it here, or simply upload your concept note (PDF or Word)." : "Published to your panel.",
      done: todo.length === 0,
      href: todo[0] ? `/sessions/${todo[0].sessionId}/brief` : null,
    });
  }

  // Arrival: 20 minutes before whichever comes first, their own session or a programme they host.
  // Hosting counts as done once they've checked in to any session that day.
  const checkedDays = new Set(opts.engagements.filter((e) => e.checkedInAt).map((e) => eventDateKey(e.start)));
  const arrivals = [
    ...speaking
      .filter((e) => !e.checkedInAt)
      .map((e) => ({ start: e.start, room: e.room, href: `/sessions/${e.sessionId}`, hosting: false })),
    ...(opts.hosting ?? [])
      .filter((h) => !h.checkedInAt && !checkedDays.has(eventDateKey(h.start)))
      .map((h) => ({ start: h.start, room: h.room, href: `/host/${h.trackId}`, hosting: true })),
  ].sort((a, b) => a.start.localeCompare(b.start));
  if (speaking.length || opts.hosting?.length) {
    const first = arrivals[0] ?? null;
    steps.push({
      key: "checkin",
      label: first ? `On the day: be in ${first.room ?? "your room"} by ${formatTime(arriveBy(first.start))}` : "Checked in",
      detail: first
        ? `${formatDay(first.start)}, ${ARRIVE_BEFORE_MIN} minutes before ${first.hosting ? "the programme you're hosting starts" : "you start"}. Tap "I'm in the room" when you arrive.`
        : "The team knows you're here.",
      done: !first,
      href: first?.href ?? null,
    });
  }
  return steps;
}
