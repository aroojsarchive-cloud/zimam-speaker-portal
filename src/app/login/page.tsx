import type { Metadata } from "next";
import { Suspense } from "react";
import { eventConfig as ev } from "@/config/event";
import { getPublicEventInfo } from "@/lib/event";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

async function Notice({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const { reason } = await searchParams;
  if (reason === "expired")
    return (
      <p
        role="status"
        className="mt-8 rounded-xl bg-brand-soft px-4 py-3 text-[0.95rem]"
      >
        That link has expired or was already used. Enter your email and
        we&apos;ll send a fresh one.
      </p>
    );
  if (reason === "bad-link")
    return (
      <p role="status" className="mt-8 rounded-xl bg-brand-soft px-4 py-3 text-[0.95rem]">
        That link didn&apos;t work. Just enter the email address your invitation was sent to.
      </p>
    );
  if (reason === "not-linked")
    return (
      <p
        role="status"
        className="mt-8 rounded-xl bg-brand-soft px-4 py-3 text-[0.95rem]"
      >
        You&apos;re signed in, but that email isn&apos;t on the speaker list for
        this event. Try the address your invitation was sent to.
      </p>
    );
  return null;
}

async function FormWithContact() {
  const contact = await getPublicEventInfo().catch(() => null);
  return (
    <LoginForm
      contact={
        contact
          ? {
              name: contact.contactName,
              whatsapp: contact.whatsapp,
              phone: contact.phone,
            }
          : null
      }
    />
  );
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex-1 flex flex-col">
      <div className="mx-auto w-full max-w-md flex-1 flex flex-col px-6 pt-14 pb-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ev.logo.wordmark}
          alt={ev.logo.alt}
          width={112}
          height={40}
          className="h-10 w-auto self-start"
        />

        <div className="mt-14">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.14em] text-brand-strong">
            Speaker portal
          </p>
          <h1 className="mt-3 font-display text-[2.5rem] leading-[1.05] font-semibold tracking-tight">
            {ev.name}
          </h1>
          <p className="mt-3 text-ink-muted">
            {ev.dates}
            <br />
            {ev.venue}
          </p>
        </div>

        <Suspense fallback={null}>
          <Notice searchParams={searchParams} />
        </Suspense>

        <Suspense fallback={<LoginForm contact={null} />}>
          <FormWithContact />
        </Suspense>

        <p className="mt-auto pt-12 text-sm text-ink-muted">
          No password needed. Use the email address your invitation was sent
          to, and you&apos;ll stay signed in on this device.
        </p>
      </div>
    </main>
  );
}
