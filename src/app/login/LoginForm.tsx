"use client";
import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";
import { ContactLinks } from "@/components/ContactLinks";

type Contact = { name: string; whatsapp: string | null; phone: string | null } | null;

const input =
  "mt-2 block h-14 w-full rounded-xl border border-line bg-surface px-4 text-lg outline-none transition focus:border-brand-strong focus:ring-4 focus:ring-brand/15";

export function LoginForm({ contact }: { contact: Contact }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, { status: "idle" });
  const askPassword = state.status === "password";

  return (
    <form action={action} className="mt-10" noValidate>
      <label htmlFor="email" className="block font-medium">
        Your email verification
      </label>
      <input
        id="email"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        readOnly={askPassword}
        defaultValue={"email" in state ? state.email : undefined}
        aria-describedby="login-feedback"
        className={`${input} ${askPassword ? "text-ink-muted" : ""}`}
        placeholder="name@organisation.org"
      />

      {askPassword && (
        <>
          <label htmlFor="password" className="mt-5 block font-medium">
            Producer password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            className={input}
          />
        </>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 h-14 w-full rounded-xl bg-brand-strong text-lg font-semibold text-white transition hover:brightness-110 active:brightness-95 disabled:opacity-70"
      >
        {pending ? "Signing in…" : askPassword ? "Sign in" : "Continue"}
      </button>

      <div id="login-feedback" aria-live="polite">
        {askPassword && state.wrong && (
          <p className="mt-4 text-danger" role="alert">
            That password isn&apos;t right. Please try again.
          </p>
        )}
        {state.status === "unknown" && (
          <div className="mt-6 rounded-2xl bg-brand-soft p-5">
            <p className="font-semibold">We couldn&apos;t find you</p>
            <p className="mt-1 text-[0.95rem]">
              <span className="break-all">{state.email}</span> isn&apos;t on our speaker list. Try the address your
              invitation was sent to
              {contact?.whatsapp || contact?.phone ? `, or message ${contact.name} and we'll sort it out.` : "."}
            </p>
            {contact && <ContactLinks name={contact.name} whatsapp={contact.whatsapp} phone={contact.phone} className="mt-4" />}
          </div>
        )}
        {state.status === "error" && (
          <p className="mt-4 text-danger" role="alert">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
