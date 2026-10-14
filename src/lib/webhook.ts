import type Stripe from "stripe";
import type { Store } from "@/lib/db";
import { round2 } from "@/lib/money";

/**
 * Pure webhook handler: given a Stripe event and a store, apply it.
 * Kept free of HTTP so it can be unit-tested directly.
 */
export async function handleStripeEvent(event: Stripe.Event, store: Store): Promise<{ handled: boolean; note: string }> {
  const fresh = await store.recordStripeEvent(event.id, event.type);
  if (!fresh) return { handled: false, note: "duplicate event" };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const invoiceId = session.metadata?.invoice_id;
      if (!invoiceId) return { handled: false, note: "no invoice_id in metadata" };
      if (session.payment_status !== "paid") return { handled: false, note: `payment_status=${session.payment_status}` };
      const amount = round2((session.amount_total ?? 0) / 100);
      const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
      const p = await store.addPaymentAdmin(invoiceId, {
        amount,
        method: "card",
        stripe_payment_intent_id: pi,
        note: "Paid online via Stripe",
      });
      return { handled: Boolean(p), note: p ? "payment recorded" : "invoice not found" };
    }
    case "account.updated": {
      const acct = event.data.object as Stripe.Account;
      const contractorId = acct.metadata?.contractor_id;
      if (!contractorId) return { handled: false, note: "no contractor_id" };
      await store.updateContractorAdmin(contractorId, {
        stripe_account_id: acct.id,
        stripe_onboarded: Boolean(acct.charges_enabled && acct.details_submitted),
      });
      return { handled: true, note: "account status updated" };
    }
    default:
      return { handled: false, note: `ignored ${event.type}` };
  }
}
