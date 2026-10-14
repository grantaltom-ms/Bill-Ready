"use client";

import { useActionState } from "react";
import { saveCustomerAction, type ActionResult } from "@/app/actions";
import { FormMessage, SubmitButton } from "@/components/forms";
import type { Customer } from "@/lib/types";

export function CustomerForm({ customer, next }: { customer?: Customer; next?: string }) {
  const [result, action] = useActionState<ActionResult | null, FormData>(saveCustomerAction, null);
  const c = customer;
  return (
    <form action={action} className="space-y-4">
      {c && <input type="hidden" name="id" value={c.id} />}
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label htmlFor="display_name">Name</label>
        <input id="display_name" name="display_name" required defaultValue={c?.display_name} placeholder="Bob Henderson" autoFocus />
      </div>
      <div>
        <label htmlFor="company">Company (optional)</label>
        <input id="company" name="company" defaultValue={c?.company ?? ""} placeholder="Milestone Properties" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" inputMode="email" defaultValue={c?.email ?? ""} />
        </div>
        <div>
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" defaultValue={c?.phone ?? ""} />
        </div>
      </div>
      <div>
        <label htmlFor="service_address">Service address</label>
        <textarea id="service_address" name="service_address" rows={2} defaultValue={c?.service_address ?? ""} placeholder="Where the work happens" />
      </div>
      <div>
        <label htmlFor="billing_address">Billing address (if different)</label>
        <textarea id="billing_address" name="billing_address" rows={2} defaultValue={c?.billing_address ?? ""} />
      </div>
      <div>
        <label htmlFor="qbo_display_name">QuickBooks display name (optional)</label>
        <input id="qbo_display_name" name="qbo_display_name" defaultValue={c?.qbo_display_name ?? ""} placeholder="Exactly as it appears in QuickBooks" />
        <p className="mt-1 text-xs text-muted">Used in exports so QuickBooks matches the right customer.</p>
      </div>
      <div>
        <label htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={c?.notes ?? ""} placeholder="Gate code, net-30 terms, etc." />
      </div>
      <FormMessage result={result} />
      <SubmitButton>{c ? "Save changes" : "Save customer"}</SubmitButton>
    </form>
  );
}
