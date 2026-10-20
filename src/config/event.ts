// Everything that makes this portal "ZIMAM". To re-skin for another conference,
// edit this file (and drop the new logo files into /public/brand). No other code changes.

export const eventConfig = {
  /** Must match events.slug in the database. */
  slug: "zimam-2026",
  name: "9th ZIMAM Digital Health Forum",
  shortName: "ZIMAM",
  dates: "4–6 November 2026",
  venue: "Jumeirah Emirates Towers, Dubai",
  timezone: "Asia/Dubai",
  timezoneLabel: "Dubai time (GST)",
  emailSenderName: "ZIMAM Digital Health Forum",

  logo: { full: "/brand/zimam-logo.png", wordmark: "/brand/zimam-wordmark.png", alt: "ZIMAM" },

  /** Used until the producer fills in contact details on the dashboard. */
  fallbackContact: { name: "The ZIMAM team", phone: null as string | null, whatsapp: null as string | null },

  colours: {
    /** Logo orange. Decorative and large text only: 3.5:1 on white. */
    brand: "#F15922",
    /** Darker orange for buttons and small text: passes WCAG AA (5.2:1 on white). */
    brandStrong: "#C2410C",
    brandSoft: "#FFF3EC",
    ink: "#141416",
    inkMuted: "#5C5C66",
    line: "#E7E4E0",
    paper: "#FBFAF8",
    surface: "#FFFFFF",
    success: "#1E7A4C",
    warning: "#9A5B00",
    danger: "#B42318",
  },

  /**
   * All text uses `local` where it's installed (Calibri ships with Windows and Office),
   * otherwise the Google Font `web`, Carlito, which is metric-compatible with Calibri.
   */
  fonts: { local: "Calibri", web: "Carlito" },
} as const;

export type EventConfig = typeof eventConfig;
