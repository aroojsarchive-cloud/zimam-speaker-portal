import { Suspense } from "react";
import { eventConfig as ev } from "@/config/event";
import { AdminNav, AdminNavFallback } from "@/components/AdminNav";
import { signOut } from "@/app/auth/confirm/actions";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex-1">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-6">
          <div className="flex items-center gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ev.logo.wordmark} alt={ev.logo.alt} width={78} height={28} className="h-7 w-auto" />
            <Suspense fallback={<AdminNavFallback />}>
              <AdminNav />
            </Suspense>
          </div>
          <form action={signOut}>
            <button className="h-10 px-3 text-sm text-ink-muted hover:underline">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
