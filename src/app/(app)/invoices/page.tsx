import Link from "next/link";
import { requireContractor } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { fmtMoney } from "@/lib/money";
import { StatusPill } from "@/components/status";

export default async function InvoicesPage() {
  const { contractor } = await requireContractor();
  const invoices = await getStore().listInvoices(contractor.id);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium">Invoices</h1>
        <Link href="/invoices/new" className="btn-primary">
          New invoice
        </Link>
      </div>
      {invoices.length === 0 ? (
        <p className="card text-sm text-muted">No invoices yet.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
          {invoices.map((i) => (
            <li key={i.id}>
              <Link href={`/invoices/${i.id}`} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{i.customer.display_name}</p>
                  <p className="text-xs text-muted">#{i.invoice_number} · {i.issue_date} · due {i.due_date}</p>
                </div>
                <div className="ml-3 flex flex-col items-end gap-1">
                  <span className="font-semibold">{fmtMoney(i.total)}</span>
                  <StatusPill status={i.status} dueDate={i.due_date} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
