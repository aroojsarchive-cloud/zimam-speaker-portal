import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import { eventConfig as ev } from "@/config/event";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${ev.shortName} Speaker Portal`, template: `%s · ${ev.shortName}` },
  description: `Your sessions at the ${ev.name}, always up to date.`,
  appleWebApp: { capable: true, title: ev.shortName, statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: ev.colours.brand, width: "device-width", initialScale: 1 };

const c = ev.colours;
const brandVars = {
  "--brand": c.brand,
  "--brand-strong": c.brandStrong,
  "--brand-soft": c.brandSoft,
  "--ink": c.ink,
  "--ink-muted": c.inkMuted,
  "--line": c.line,
  "--paper": c.paper,
  "--surface": c.surface,
  "--success": c.success,
  "--warning": c.warning,
  "--danger": c.danger,
  "--font-body": `"${ev.fonts.local}", "${ev.fonts.web}"`,
  "--font-display-face": `"${ev.fonts.local}", "${ev.fonts.web}"`,
} as CSSProperties;

const fontsHref =
  "https://fonts.googleapis.com/css2?" +
  `family=${ev.fonts.web.replace(/ /g, "+")}:ital,wght@0,400;0,700;1,400` +
  "&display=swap";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" style={brandVars} className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={fontsHref} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
