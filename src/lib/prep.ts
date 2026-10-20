import { formatDay, formatTime } from "@/lib/time";

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
  hasSlides: boolean;
  /** Set from the programme: only presenters are asked for slides. */
  presents: boolean;
  briefPublished: boolean;
  checkedInAt: string | null;
};

export type StepKey = "details" | "guidelines" | "session" | "slides" | "brief" | "checkin";
export type Step = { key: StepKey; label: string; detail: string; done: boolean; href: string | null };

export const needsSlides = (e: PrepEngagement) => e.speaking && e.presents;
export const arriveBy = (start: string) => new Date(new Date(start).getTime() - ARRIVE_BEFORE_MIN * 60000).toISOString();

export function prepSteps(opts: { detailsConfirmed: boolean; guidelinesAck: boolean; engagements: PrepEngagement[] }): Step[] {
  const speaking = opts.engagements.filter((e) => e.speaking);
  const steps: Step[] = [
    {
      key: "details",
      label: "Check your name and details",
      detail: "This is how you'll appear on screen and in print.",
      done: opts.detailsConfirmed,
      href: "#details-h",
    },
  ];

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
        : `All ${speaking.length > 1 ? `${speaking.length} sessions` : "done"} checked.`,
      done: todo.length === 0,
      href: todo[0] ? `/sessions/${todo[0].sessionId}#review` : null,
    });
  }

  const slideables = opts.engagements.filter(needsSlides);
  if (slideables.length) {
    const todo = slideables.filter((e) => !e.hasSlides && !e.noSlides);
    steps.push({
      key: "slides",
      label: "Upload your presentation",
      detail: todo.length ? "Or tell us you're not using slides." : "Done, thank you.",
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
      detail: todo.length ? "Summary, objectives and questions for your panel." : "Published to your panel.",
      done: todo.length === 0,
      href: todo[0] ? `/sessions/${todo[0].sessionId}/brief` : null,
    });
  }

  if (speaking.length) {
    const first = [...speaking].sort((a, b) => a.start.localeCompare(b.start)).find((e) => !e.checkedInAt) ?? null;
    steps.push({
      key: "checkin",
      label: first ? `On the day: be in ${first.room ?? "your room"} by ${formatTime(arriveBy(first.start))}` : "Checked in",
      detail: first
        ? `${formatDay(first.start)}, ${ARRIVE_BEFORE_MIN} minutes before you start. Tap "I'm in the room" when you arrive.`
        : "The team knows you're here.",
      done: !first,
      href: first ? `/sessions/${first.sessionId}` : null,
    });
  }
  return steps;
}
