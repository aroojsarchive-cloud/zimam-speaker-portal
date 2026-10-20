import Link from "next/link";
import { Suspense } from "react";
import { eventConfig as ev } from "@/config/event";
import { NavTabs, NavTabsFallback } from "@/components/NavTabs";
import { LiveRefresh } from "@/components/LiveRefresh";

export default function SpeakerLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex-1">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex h-11 items-center" aria-label={`${ev.shortName} home`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ev.logo.wordmark} alt={ev.logo.alt} width={78} height={28} className="h-7 w-auto" />
          </Link>
          <Suspense fallback={<NavTabsFallback />}>
            <NavTabs />
          </Suspense>
        </div>
      </header>
      <LiveRefresh />
      {children}
    </div>
  );
}
