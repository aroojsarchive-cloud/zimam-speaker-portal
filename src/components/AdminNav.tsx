"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Speakers" },
  { href: "/admin/programme", label: "Programme" },
  { href: "/admin/live", label: "Live" },
];

export function AdminNav() {
  return <Tabs path={usePathname()} />;
}
export function AdminNavFallback() {
  return <Tabs path={null} />;
}

function Tabs({ path }: { path: string | null }) {
  return (
    <nav aria-label="Producer" className="flex gap-1">
      {TABS.map((t) => {
        const active = path !== null && (t.href === "/admin" ? path === "/admin" : path.startsWith(t.href));
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-10 items-center rounded-lg px-3 text-[0.95rem] font-semibold ${
              active ? "bg-ink text-white" : "text-ink-muted hover:bg-line/60 hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
