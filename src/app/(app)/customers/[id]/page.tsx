import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContractor } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { fmtMoney } from "@/lib/money";
import { StatusPill } from "@/components/status";
import { CustomerForm } from "@/components/customer-form";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { contractor } = await requireContractor();
  const store = getStore();
  const customer = await store.getCustomer(contractor.id, id);
  if (!customer) notFound();
  const invoices = (await store.listInvoices(contractor.id)).filter((i) => i.customer_id === id);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{customer.display_name}</h1>
        <Link href={`/invoices/new?customer=${customer.id}`} className="btn-primary">
          New invoice
        </Link>
      </div>
      <section>
        <h2 className="mb-2 font-semibold">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="card text-sm text-muted">No invoices for this customer yet.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {invoices.map((i) => (
              <li key={i.id}>
                <Link href={`/invoices/${i.id}`} className="flex items-center justify-between px-4 py-3">
                  <span>#{i.invoice_number} · {i.issue_date}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{fmtMoney(i.total)}</span>
                    <StatusPill status={i.status} dueDate={i.due_date} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card">
        <h2 className="mb-3 font-semibold">Details</h2>
        <CustomerForm customer={customer} />
      </section>
    </div>
  );
}
