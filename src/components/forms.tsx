"use client";

import { useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/app/actions";

export function SubmitButton({
  children,
  pendingText = "Saving…",
  className = "btn-primary w-full",
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  // Lets tests (and screen readers) know the form is interactive; avoids submitting before hydration.
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return (
    <button type="submit" className={className} disabled={pending} data-hydrated={hydrated ? "true" : undefined}>
      {pending ? pendingText : children}
    </button>
  );
}

export function FormMessage({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  if (result.ok)
    return result.message ? (
      <p role="status" className="callout">
        {result.message}
      </p>
    ) : null;
  return (
    <p role="alert" className="callout callout-error">
      {result.error}
    </p>
  );
}
