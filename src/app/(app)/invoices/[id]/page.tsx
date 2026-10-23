import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContractor } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { fmtMoney } from "@/lib/money";
import { appUrl } from "@/lib/stripe";
import { StatusPill } from "@/components/status";
import { InvoiceActions } from "@/components/invoice-actions";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { contractor } = await requireContractor();
  const invoice = await getStore().getInvoice(contractor.id, id);
  if (!invoice) notFound();
  const due = invoice.total - invoice.amount_paid;
  const payUrl = `${appUrl()}/pay/${invoice.public_token}`;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium">Invoice #{invoice.invoice_number}</h1>
          <Link href={`/customers/${invoice.customer.id}`} className="text-sm text-accent">
            {invoice.customer.display_name}
          </Link>
        </div>
        <StatusPill status={invoice.status} dueDate={invoice.due_date} />
      </div>

      <div className="card">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted">{invoice.status === "paid" ? "Paid" : "Balance due"}</span>
          <span className="text-2xl font-bold tabular-nums" data-testid="balance-due">
            {fmtMoney(invoice.status === "paid" ? invoice.amount_paid : due)}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">
          Issued {invoice.issue_date} · Due {invoice.due_date}
          {invoice.paid_at ? ` · Paid ${invoice.paid_at.slice(0, 10)}` : ""}
        </p>
      </div>

      <InvoiceActions invoice={invoice} payUrl={payUrl} />

      <section className="card">
        <ul className="divide-y divide-line">
          {invoice.lines.map((l) => (
            <li key={l.id} className="flex justify-between py-2 text-sm">
              <span>
                {l.description}
                <span className="block text-xs text-muted">
                  {l.quantity} × {fmtMoney(l.rate)}
                  {l.taxable ? " · taxable" : ""}
                </span>
              </span>
              <span className="tabular-nums">{fmtMoney(l.amount)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
          <Row label="Subtotal" value={fmtMoney(invoice.subtotal)} />
          <Row label={`Tax (${(invoice.tax_rate * 100).toFixed(2)}%)`} value={fmtMoney(invoice.tax_amount)} />
          <Row label="Total" value={fmtMoney(invoice.total)} bold />
          {invoice.amount_paid > 0 && <Row label="Paid" value={`−${fmtMoney(invoice.amount_paid)}`} />}
        </div>
        {invoice.notes && <p className="mt-3 text-sm text-muted">{invoice.notes}</p>}
      </section>

      {invoice.payments.length > 0 && (
        <section className="card">
          <h2 className="mb-2 font-medium">Payments</h2>
          <ul className="divide-y divide-line text-sm">
            {invoice.payments.map((p) => (
              <li key={p.id} className="flex justify-between py-2">
                <span>
                  {p.received_at.slice(0, 10)} · {p.method}
                  {p.note ? <span className="block text-xs text-muted">{p.note}</span> : null}
                </span>
                <span className="tabular-nums">{fmtMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex gap-2">
        <a href={`/api/invoices/${invoice.id}/pdf`} className="btn-secondary flex-1" target="_blank" rel="noreferrer">
          PDF
        </a>
        {invoice.status !== "paid" && invoice.status !== "void" && (
          <Link href={`/invoices/${invoice.id}/edit`} className="btn-secondary flex-1">
            Edit
          </Link>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
