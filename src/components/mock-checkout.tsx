"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { fmtMoney } from "@/lib/money";

/**
 * Only rendered in BILLREADY_TEST_MODE. Stands in for Stripe's hosted Checkout page:
 * clicking "Pay" posts the same webhook Stripe would, so the e2e test exercises the real handler.
 */
export function MockCheckout({ invoiceId, amount, token }: { invoiceId: string; amount: number; token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const pay = async () => {
    setBusy(true);
    const evt = {
      id: `evt_mock_${Date.now()}`,
      type: "checkout.session.completed",
      data: {
        object: {
          id: `cs_mock_${Date.now()}`,
          payment_status: "paid",
          amount_total: Math.round(amount * 100),
          payment_intent: `pi_mock_${Date.now()}`,
          metadata: { invoice_id: invoiceId },
        },
      },
    };
    await fetch("/api/stripe/webhook", { method: "POST", body: JSON.stringify(evt), headers: { "content-type": "application/json" } });
    router.push(`/pay/${token}?paid=1`);
    router.refresh();
  };
  return (
    <div className="card mt-4 border-dashed" data-testid="mock-checkout">
      <p className="text-sm font-semibold">Test checkout (Stripe stand-in)</p>
      <p className="text-xs text-muted">Card 4242 4242 4242 4242 · any future date · any CVC</p>
      <button className="btn-primary mt-3 w-full" onClick={pay} disabled={busy}>
        {busy ? "Paying…" : `Pay ${fmtMoney(amount)}`}
      </button>
    </div>
  );
}
