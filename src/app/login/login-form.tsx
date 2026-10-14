"use client";

import { useActionState } from "react";
import { sendMagicLink, type ActionResult } from "@/app/actions";
import { FormMessage, SubmitButton } from "@/components/forms";

export function LoginForm({ initialError }: { initialError: string | null }) {
  const [result, action] = useActionState<ActionResult | null, FormData>(sendMagicLink, null);
  return (
    <form action={action} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" inputMode="email" autoComplete="email" required placeholder="you@company.com" />
      </div>
      <FormMessage result={result ?? (initialError ? { ok: false, error: initialError } : null)} />
      <SubmitButton pendingText="Sending…">Email me a sign-in link</SubmitButton>
    </form>
  );
}
