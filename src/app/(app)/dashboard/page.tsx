import Link from "next/link";
import { requireContractor } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { fmtMoney, todayISO } from "@/lib/money";
import { StatusPill } from "@/components/status";

export default async function Dashboard() {
  const { contractor } = await requireContractor();
  const invoices = await getStore().listInvoices(contractor.id);
  const today = todayISO();
  const open = invoices.filter((i) => i.status === "sent");
  const outstanding = open.reduce((a, i) => a + (i.total - i.amount_paid), 0);
  const overdue = open.filter((i) => i.due_date < today).reduce((a, i) => a + (i.total - i.amount_paid), 0);
  const month = today.slice(0, 7);
  const paidThisMonth = invoices
    .filter((i) => i.status === "paid" && (i.paid_at ?? "").startsWith(month))
    .reduce((a, i) => a + i.amount_paid, 0);

  return (
    <div className="space-y-5">
      {!contractor.stripe_onboarded && (
        <Link href="/settings" className="card block border-accent/40 bg-accent-soft">
          <p className="font-semibold text-accent">Connect Stripe to take card payments</p>
          <p className="text-sm text-muted">Takes about 5 minutes. Until then, you can still send invoices and record checks.</p>
        </Link>
      )}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Outstanding" value={fmtMoney(outstanding)} />
        <Stat label="Overdue" value={fmtMoney(overdue)} tone={overdue > 0 ? "warn" : undefined} />
        <Stat label="Paid this month" value={fmtMoney(paidThisMonth)} tone="ok" />
      </div>
      <Link href="/invoices/new" className="btn-primary w-full">
        New invoice
      </Link>
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-medium">Recent invoices</h2>
          <Link href="/invoices" className="text-sm text-accent">
            All
          </Link>
        </div>
        {invoices.length === 0 ? (
          <p className="card text-sm text-muted">No invoices yet. Add a customer, then create your first invoice.</p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
            {invoices.slice(0, 8).map((i) => (
              <li key={i.id}>
                <Link href={`/invoices/${i.id}`} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{i.customer.display_name}</p>
                    <p className="text-xs text-muted">
                      #{i.invoice_number} · due {i.due_date}
                    </p>
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
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "ok" }) {
  return (
    <div className="card px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 text-base font-bold ${tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : ""}`}>{value}</p>
    </div>
  );
}
