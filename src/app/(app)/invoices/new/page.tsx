import Link from "next/link";
import { requireContractor } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { addDaysISO, todayISO } from "@/lib/money";
import { InvoiceForm } from "@/components/invoice-form";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { customer } = await searchParams;
  const { contractor } = await requireContractor();
  const customers = await getStore().listCustomers(contractor.id);
  const today = todayISO();
  if (customers.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-medium">New invoice</h1>
        <div className="card space-y-3">
          <p className="text-sm text-muted">You need a customer before you can invoice. It only takes a few seconds.</p>
          <Link href="/customers/new?next=/invoices/new" className="btn-primary w-full">
            Add your first customer
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium">New invoice</h1>
      <InvoiceForm
        customers={customers}
        defaults={{
          customer_id: customer ?? "",
          issue_date: today,
          due_date: addDaysISO(today, 30),
          tax_rate_pct: Math.round(contractor.default_tax_rate * 10000) / 100,
        }}
      />
    </div>
  );
}
