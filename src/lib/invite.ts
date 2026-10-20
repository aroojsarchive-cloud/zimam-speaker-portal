import { eventConfig as ev } from "@/config/event";

export const inviteUrl = (site: string, token: string) => `${site.replace(/\/$/, "")}/i/${token}`;

/** The WhatsApp / email invite text the producer sends with a personal link. */
export function inviteMessage(opts: { salutation: string | null; fullName: string; url: string }) {
  const first = opts.fullName.split(" ")[0];
  const greet = opts.salutation ? `${opts.salutation} ${opts.fullName.split(" ").slice(-1)[0]}` : first;
  return [
    `Dear ${greet},`,
    ``,
    `Your speaker portal for the ${ev.name} (${ev.dates}, ${ev.venue}) is ready:`,
    opts.url,
    ``,
    `It shows your session time, room and role, your brief, who you're on stage with, and the full agenda, always up to date. No password needed: the link signs you straight in.`,
    ``,
    `Please check your name, title and photo, as this is how you'll appear on screen and in print, and upload your slides there if you're presenting.`,
  ].join("\n");
}
