"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "My event" },
  { href: "/agenda", label: "Agenda" },
];

export function NavTabs() {
  return <Tabs path={usePathname()} />;
}

/** Shown while the current path streams in. */
export function NavTabsFallback() {
  return <Tabs path={null} />;
}

function Tabs({ path }: { path: string | null }) {
  return (
    <nav aria-label="Main" className="flex rounded-full bg-line/60 p-1">
      {TABS.map((t) => {
        const active =
          path !== null && (t.href === "/" ? path === "/" || path.startsWith("/sessions") : path.startsWith(t.href));
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-10 items-center rounded-full px-4 text-[0.95rem] font-semibold transition ${
              active ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
