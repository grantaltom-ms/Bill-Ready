"use client";

import { useActionState } from "react";
import { sendMagicLink, type ActionResult } from "@/app/actions";
import { FormMessage, SubmitButton } from "@/components/forms";

export default function LoginPage() {
  const [result, action] = useActionState<ActionResult | null, FormData>(sendMagicLink, null);
  return (
    <main className="flex flex-1 flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-bold">Sign in to Bill Ready</h1>
        <p className="mt-1 text-sm text-muted">
          No password. We&apos;ll email you a sign-in link. New here? Same button creates your account.
        </p>
        <form action={action} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required placeholder="you@company.com" />
          </div>
          <FormMessage result={result} />
          <SubmitButton pendingText="Sending…">Email me a sign-in link</SubmitButton>
        </form>
      </div>
    </main>
  );
}
