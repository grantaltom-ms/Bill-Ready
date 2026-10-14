import { beforeEach, describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { memoryStore, resetMemoryStore } from "@/lib/db/memory";
import { handleStripeEvent } from "@/lib/webhook";

async function seedInvoice(total = 324.49) {
  const c = await memoryStore.createContractor("u1", { business_name: "Test Co" });
  const cust = await memoryStore.createCustomer(c.id, { display_name: "Bob" });
  const inv = await memoryStore.createInvoice(c.id, {
    customer_id: cust.id, issue_date: "2026-10-14", due_date: "2026-11-13", tax_rate: 0,
    lines: [{ description: "Job", quantity: 1, rate: total, taxable: false }],
  });
  await memoryStore.setInvoiceStatus(c.id, inv.id, "sent");
  return { c, inv };
}

function checkoutEvent(invoiceId: string, cents: number, id = "evt_1", pi = "pi_1"): Stripe.Event {
  return {
    id, type: "checkout.session.completed",
    data: { object: { id: "cs_1", payment_status: "paid", amount_total: cents, payment_intent: pi, metadata: { invoice_id: invoiceId } } },
  } as unknown as Stripe.Event;
}

describe("Stripe webhook handler", () => {
  beforeEach(() => resetMemoryStore());

  it("records the payment and marks the invoice paid", async () => {
    const { c, inv } = await seedInvoice();
    const r = await handleStripeEvent(checkoutEvent(inv.id, 32449), memoryStore);
    expect(r.handled).toBe(true);
    const after = await memoryStore.getInvoice(c.id, inv.id);
    expect(after!.status).toBe("paid");
    expect(after!.amount_paid).toBe(324.49);
    expect(after!.payments[0].method).toBe("card");
  });

  it("ignores a replayed event (Stripe retries) without double-counting", async () => {
    const { c, inv } = await seedInvoice();
    await handleStripeEvent(checkoutEvent(inv.id, 32449), memoryStore);
    const r2 = await handleStripeEvent(checkoutEvent(inv.id, 32449), memoryStore);
    expect(r2).toEqual({ handled: false, note: "duplicate event" });
    const after = await memoryStore.getInvoice(c.id, inv.id);
    expect(after!.payments).toHaveLength(1);
    expect(after!.amount_paid).toBe(324.49);
  });

  it("dedupes by payment intent even under a new event id", async () => {
    const { c, inv } = await seedInvoice();
    await handleStripeEvent(checkoutEvent(inv.id, 32449, "evt_a", "pi_same"), memoryStore);
    await handleStripeEvent(checkoutEvent(inv.id, 32449, "evt_b", "pi_same"), memoryStore);
    const after = await memoryStore.getInvoice(c.id, inv.id);
    expect(after!.payments).toHaveLength(1);
  });

  it("leaves a partial payment as sent with the right balance", async () => {
    const { c, inv } = await seedInvoice(500);
    await handleStripeEvent(checkoutEvent(inv.id, 20000), memoryStore);
    const after = await memoryStore.getInvoice(c.id, inv.id);
    expect(after!.status).toBe("sent");
    expect(after!.total - after!.amount_paid).toBe(300);
  });

  it("ignores unpaid sessions and unknown invoices", async () => {
    const { inv } = await seedInvoice();
    const unpaid = checkoutEvent(inv.id, 100, "evt_u");
    (unpaid.data.object as unknown as { payment_status: string }).payment_status = "unpaid";
    expect((await handleStripeEvent(unpaid, memoryStore)).handled).toBe(false);
    expect((await handleStripeEvent(checkoutEvent("nope", 100, "evt_n"), memoryStore)).handled).toBe(false);
  });

  it("updates the contractor when Stripe finishes onboarding", async () => {
    const { c } = await seedInvoice();
    const evt = {
      id: "evt_acct", type: "account.updated",
      data: { object: { id: "acct_123", charges_enabled: true, details_submitted: true, metadata: { contractor_id: c.id } } },
    } as unknown as Stripe.Event;
    await handleStripeEvent(evt, memoryStore);
    const after = await memoryStore.contractorForUser("u1");
    expect(after!.stripe_onboarded).toBe(true);
    expect(after!.stripe_account_id).toBe("acct_123");
  });
});
