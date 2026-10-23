"use client";

import { useActionState, useState, useTransition } from "react";
import { markSentAction, recordPaymentAction, sendInvoiceAction, voidInvoiceAction, type ActionResult } from "@/app/actions";
import { FormMessage, SubmitButton } from "@/components/forms";
import { todayISO } from "@/lib/money";
import type { InvoiceWithDetails } from "@/lib/types";

export function InvoiceActions({ invoice, payUrl }: { invoice: InvoiceWithDetails; payUrl: string }) {
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const [showPayment, setShowPayment] = useState(false);
  const [payResult, payAction] = useActionState<ActionResult | null, FormData>(recordPaymentAction, null);
  const due = invoice.total - invoice.amount_paid;
  // After a payment saves, fold the form away until "Record payment" is pressed again.
  const [seenResult, setSeenResult] = useState<ActionResult | null>(null);
  const formOpen = showPayment && !(payResult?.ok && payResult !== seenResult);
  const closed = invoice.status === "paid" || invoice.status === "void";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(payUrl);
      setMsg({ ok: true, message: "Payment link copied" });
    } catch {
      setMsg({ ok: false, error: payUrl });
    }
  };

  return (
    <div className="space-y-3">
      {!closed && (
        <div className="grid grid-cols-2 gap-2">
          <button
            className="btn-primary col-span-2"
            disabled={pending || !invoice.customer.email}
            onClick={() => start(async () => setMsg(await sendInvoiceAction(invoice.id)))}
            title={invoice.customer.email ? undefined : "Add an email to the customer first"}
          >
            {pending ? "Sending…" : invoice.status === "draft" ? "Email invoice" : "Resend email"}
          </button>
          <button className="btn-secondary" onClick={copyLink} type="button">
            Copy pay link
          </button>
          {invoice.status === "draft" ? (
            <button className="btn-secondary" disabled={pending} onClick={() => start(async () => setMsg(await markSentAction(invoice.id)))}>
              Mark as sent
            </button>
          ) : (
            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                setSeenResult(payResult);
                setShowPayment(!formOpen);
              }}
            >
              Record payment
            </button>
          )}
        </div>
      )}
      <FormMessage result={msg} />
      {payResult?.ok && !formOpen && <FormMessage result={payResult} />}

      {formOpen && !closed && (
        <form action={payAction} className="card space-y-3">
          <input type="hidden" name="invoice_id" value={invoice.id} />
          <h3 className="font-medium">Record a payment</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="amount">Amount</label>
              <input id="amount" name="amount" type="number" step="0.01" min="0.01" inputMode="decimal" defaultValue={due.toFixed(2)} required />
            </div>
            <div>
              <label htmlFor="method">Method</label>
              <select id="method" name="method" defaultValue="check">
                <option value="check">Check</option>
                <option value="cash">Cash</option>
                <option value="ach">Bank transfer</option>
                <option value="card">Card (offline)</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="received_at">Received on</label>
            <input id="received_at" name="received_at" type="date" defaultValue={todayISO()} required />
          </div>
          <div>
            <label htmlFor="note">Note (check #, etc.)</label>
            <input id="note" name="note" />
          </div>
          <FormMessage result={payResult} />
          <SubmitButton pendingText="Recording…">Save payment</SubmitButton>
        </form>
      )}

      {!closed && (
        <button
          className="btn-ghost w-full text-danger"
          disabled={pending}
          onClick={() => {
            if (confirm("Void this invoice? It will no longer be payable.")) start(async () => setMsg(await voidInvoiceAction(invoice.id)));
          }}
        >
          Void invoice
        </button>
      )}
    </div>
  );
}
