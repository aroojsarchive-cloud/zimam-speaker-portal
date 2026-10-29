import { Suspense } from "react";
import { eventConfig as ev } from "@/config/event";
import { AdminNav, AdminNavFallback } from "@/components/AdminNav";
import { signOut } from "@/app/auth/confirm/actions";

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex-1">
      <header className="border-b border-line bg-surface print:hidden">
        {/* Phones: logo + sign out on top, tabs on their own row underneath. */}
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 sm:h-16 sm:flex-nowrap sm:px-6 sm:py-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ev.logo.wordmark} alt={ev.logo.alt} width={78} height={28} className="h-7 w-auto" />
          <div className="order-last w-full sm:order-none sm:w-auto">
            <Suspense fallback={<AdminNavFallback />}>
              <AdminNav />
            </Suspense>
          </div>
          <form action={signOut} className="ml-auto">
            <button className="h-10 px-3 text-sm text-ink-muted hover:underline">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:p-0">{children}</main>
    </div>
  );
}
