"use client";

import { useActionState } from "react";
import { createContractorAction, type ActionResult } from "@/app/actions";
import { FormMessage, SubmitButton } from "@/components/forms";

export default function OnboardingPage() {
  const [result, action] = useActionState<ActionResult | null, FormData>(createContractorAction, null);
  return (
    <main className="flex flex-1 flex-col px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="text-2xl font-bold">Set up your business</h1>
        <p className="mt-1 text-sm text-muted">This is what shows on your invoices. You can change it later.</p>
        <form action={action} className="mt-6 space-y-4">
          <div>
            <label htmlFor="business_name">Business name</label>
            <input id="business_name" name="business_name" required placeholder="Henderson Plumbing LLC" />
          </div>
          <div>
            <label htmlFor="email">Business email</label>
            <input id="email" name="email" type="email" placeholder="office@hendersonplumbing.com" />
          </div>
          <div>
            <label htmlFor="phone">Phone</label>
            <input id="phone" name="phone" type="tel" placeholder="(206) 555-0100" />
          </div>
          <div>
            <label htmlFor="address">Address</label>
            <textarea id="address" name="address" rows={2} placeholder="123 Main St, Seattle, WA 98101" />
          </div>
          <FormMessage result={result} />
          <SubmitButton>Continue</SubmitButton>
        </form>
      </div>
    </main>
  );
}
