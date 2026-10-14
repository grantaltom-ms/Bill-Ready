"use client";

import { useActionState } from "react";
import { updateSettingsAction, type ActionResult } from "@/app/actions";
import { FormMessage, SubmitButton } from "@/components/forms";
import type { Contractor } from "@/lib/types";

export function SettingsForm({ contractor: c }: { contractor: Contractor }) {
  const [result, action] = useActionState<ActionResult | null, FormData>(updateSettingsAction, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="business_name">Business name</label>
        <input id="business_name" name="business_name" required defaultValue={c.business_name} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" defaultValue={c.email ?? ""} />
        </div>
        <div>
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" defaultValue={c.phone ?? ""} />
        </div>
      </div>
      <div>
        <label htmlFor="address">Address</label>
        <textarea id="address" name="address" rows={2} defaultValue={c.address ?? ""} />
      </div>
      <div>
        <label htmlFor="default_tax_rate">Default sales tax rate (%)</label>
        <input
          id="default_tax_rate"
          name="default_tax_rate"
          type="number"
          step="0.01"
          min="0"
          max="100"
          inputMode="decimal"
          defaultValue={(c.default_tax_rate * 100).toFixed(2)}
        />
        <p className="mt-1 text-xs text-muted">Seattle is 10.35%. Only lines you mark taxable get taxed.</p>
      </div>
      <FormMessage result={result} />
      <SubmitButton>Save</SubmitButton>
    </form>
  );
}
