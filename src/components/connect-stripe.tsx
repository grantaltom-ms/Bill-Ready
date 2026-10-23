"use client";

import { useActionState } from "react";
import { startStripeOnboarding, type ActionResult } from "@/app/actions";

export function ConnectStripe({ label }: { label: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    async () => (await startStripeOnboarding()) ?? null,
    null,
  );
  return (
    <form action={action} className="space-y-2">
      <button className="btn-primary w-full" disabled={pending} data-testid="connect-stripe">
        {pending ? "Opening Stripe…" : label}
      </button>
      {state && !state.ok ? (
        <p className="text-sm text-danger" data-testid="stripe-error">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
