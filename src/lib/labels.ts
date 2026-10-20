const ROLE: Record<string, string> = {
  moderator: "Moderator",
  panelist: "Panelist",
  keynote: "Keynote speaker",
  speaker: "Speaker",
  mc: "MC",
  jury: "Jury member",
  chair: "Chair",
  co_chair: "Co-chair",
  host: "Host",
};
export const roleLabel = (r: string) => ROLE[r] ?? r;

const STATUS: Record<string, string> = { confirmed: "Confirmed", tentative: "Tentative", invited: "Invited", tbc: "TBC" };
export const statusLabel = (s: string) => STATUS[s] ?? s;

const FORMAT: Record<string, string> = {
  keynote: "Keynote",
  panel: "Panel",
  fireside: "Fireside chat",
  lecture: "Lecture",
  opening: "Opening",
  closing: "Closing",
  break: "Break",
  contest: "Contest",
  award: "Award",
  workshop: "Workshop",
  briefing: "Briefing",
  pitches: "Live pitches",
  judging: "Judging",
  other: "Session",
};
export const formatLabel = (f: string) => FORMAT[f] ?? f;

export const displayName = (p: { salutation: string | null; full_name: string }) =>
  [p.salutation, p.full_name].filter(Boolean).join(" ");

const TITLES = new Set(["dr", "prof", "mr", "mrs", "ms", "miss", "he", "eng", "sir", "dame"]);

export const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !TITLES.has(w.replace(/\./g, "").toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
