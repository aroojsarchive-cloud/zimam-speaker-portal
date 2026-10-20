"use client";
import { useEffect, useRef, useTransition } from "react";
import { eventConfig as ev } from "@/config/event";
import { confirmSignIn } from "./actions";

export function AutoConfirm({ tokenHash, next }: { tokenHash: string; next: string }) {
  const [pending, start] = useTransition();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    start(() => confirmSignIn(tokenHash, next));
  }, [tokenHash, next]);

  return (
    <SigningIn>
      {!pending && (
        <button
          onClick={() => start(() => confirmSignIn(tokenHash, next))}
          className="mt-10 h-12 rounded-xl bg-brand-strong px-6 font-semibold text-white"
        >
          Continue to my portal
        </button>
      )}
    </SigningIn>
  );
}

export function SigningIn({ children }: { children?: React.ReactNode }) {
  return (
    <main className="flex-1 grid place-items-center px-6">
      <div className="text-center" role="status" aria-live="polite">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ev.logo.wordmark} alt={ev.logo.alt} width={112} height={40} className="mx-auto h-10 w-auto" />
        <p className="mt-8 font-display text-2xl font-semibold">Signing you in…</p>
        <div className="mx-auto mt-5 h-1 w-40 overflow-hidden rounded-full bg-line">
          <div className="h-full w-1/3 animate-[slide_1.1s_ease-in-out_infinite] rounded-full bg-brand" />
        </div>
        {children}
      </div>
      <style>{`@keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}`}</style>
    </main>
  );
}
