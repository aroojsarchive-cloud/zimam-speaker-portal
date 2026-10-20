import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AutoConfirm, SigningIn } from "./AutoConfirm";

export const metadata: Metadata = { title: "Signing you in" };

// Rendering this page does NOT use the token. A script in the browser does,
// so email security scanners that "click" links can't use it up first.
async function Confirm({ searchParams }: { searchParams: PageProps<"/auth/confirm">["searchParams"] }) {
  const { token_hash, next } = await searchParams;
  if (typeof token_hash !== "string") redirect("/login?reason=expired");
  return <AutoConfirm tokenHash={token_hash} next={typeof next === "string" ? next : "/"} />;
}

export default function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  return (
    <Suspense fallback={<SigningIn />}>
      <Confirm searchParams={searchParams} />
    </Suspense>
  );
}
