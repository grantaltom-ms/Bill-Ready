export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { getStore } from "@/lib/db";
import { fmtDateUS, fmtMoney } from "@/lib/money";
import { startCheckoutAction } from "@/app/actions";
import { MockCheckout } from "@/components/mock-checkout";

/** Public page the customer lands on from the email. No login; the long token is the secret. */
export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ paid?: string; mock_checkout?: string }>;
}) {
  const { token } = await params;
  const { paid, mock_checkout } = await searchParams;
  const inv = await getStore().getInvoiceByToken(token);
  if (!inv) notFound();
  const due = inv.total - inv.amount_paid;
  const isPaid = inv.status === "paid";
  const canPay = !isPaid && inv.status !== "void" && due > 0 && inv.contractor.stripe_onboarded;

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-5 py-8">
      <p className="text-sm text-muted">Invoice from</p>
      <h1 className="text-2xl font-bold">{inv.contractor.business_name}</h1>
      <p className="text-sm text-muted">
        {[inv.contractor.phone, inv.contractor.email].filter(Boolean).join(" · ")}
      </p>

      <div className="card mt-6">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">{isPaid ? "Paid in full" : "Amount due"}</span>
          <span className="text-3xl font-bold tabular-nums" data-testid="pay-amount">
            {fmtMoney(isPaid ? inv.amount_paid : due)}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">
          Invoice #{inv.invoice_number} · Due {fmtDateUS(inv.due_date)}
        </p>
        {paid && !isPaid && (
          <p className="mt-3 rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">
            Thanks! Your payment is processing and will show here shortly.
          </p>
        )}
        {isPaid && (
          <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-ok" data-testid="paid-banner">
            ✓ Paid {inv.paid_at?.slice(0, 10)}. Thank you!
          </p>
        )}
        {inv.status === "void" && <p className="mt-3 text-sm text-muted">This invoice has been voided.</p>}
      </div>

      {canPay && !mock_checkout && (
        <form action={startCheckoutAction.bind(null, token)} className="mt-4">
          <button className="btn-primary w-full text-lg">Pay {fmtMoney(due)} by card</button>
          <p className="mt-2 text-center text-xs text-muted">Secure checkout by Stripe</p>
        </form>
      )}
      {!isPaid && inv.status !== "void" && !inv.contractor.stripe_onboarded && (
        <p className="mt-4 text-center text-sm text-muted">Online payment isn&apos;t set up yet — please pay by check or contact {inv.contractor.business_name}.</p>
      )}
      {mock_checkout && process.env.BILLREADY_TEST_MODE === "1" && <MockCheckout invoiceId={inv.id} amount={due} token={token} />}

      <section className="card mt-6">
        <p className="mb-2 text-sm font-semibold">Bill to: {inv.customer.display_name}</p>
        <ul className="divide-y divide-line">
          {inv.lines.map((l) => (
            <li key={l.id} className="flex justify-between py-2 text-sm">
              <span>
                {l.description}
                <span className="block text-xs text-muted">
                  {l.quantity} × {fmtMoney(l.rate)}
                </span>
              </span>
              <span className="tabular-nums">{fmtMoney(l.amount)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{fmtMoney(inv.subtotal)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span>{fmtMoney(inv.tax_amount)}</span></div>
          <div className="flex justify-between font-bold"><span>Total</span><span>{fmtMoney(inv.total)}</span></div>
          {inv.amount_paid > 0 && <div className="flex justify-between"><span>Paid</span><span>−{fmtMoney(inv.amount_paid)}</span></div>}
        </div>
        {inv.notes && <p className="mt-3 text-sm text-muted">{inv.notes}</p>}
      </section>
      <p className="mt-6 text-center text-xs text-muted">
        <a className="underline" href={`/api/invoices/${inv.id}/pdf?token=${token}`}>Download PDF</a> · Powered by Bill Ready
      </p>
    </main>
  );
}
