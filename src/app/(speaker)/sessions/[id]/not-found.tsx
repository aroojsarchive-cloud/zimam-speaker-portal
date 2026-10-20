import Link from "next/link";

export default function SessionNotFound() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">We can&apos;t find that session</h1>
      <p className="mt-2 text-ink-muted">It may have been moved or isn&apos;t published yet.</p>
      <Link href="/" className="mt-6 inline-flex h-12 items-center rounded-xl bg-brand-strong px-6 font-semibold text-white">
        Back to my event
      </Link>
    </main>
  );
}
