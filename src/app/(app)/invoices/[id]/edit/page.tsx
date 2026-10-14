import { notFound } from "next/navigation";
import { requireContractor } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { InvoiceForm } from "@/components/invoice-form";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { contractor } = await requireContractor();
  const store = getStore();
  const [invoice, customers] = await Promise.all([store.getInvoice(contractor.id, id), store.listCustomers(contractor.id)]);
  if (!invoice) notFound();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Edit invoice #{invoice.invoice_number}</h1>
      <InvoiceForm
        customers={customers}
        invoice={invoice}
        defaults={{ customer_id: invoice.customer_id, issue_date: invoice.issue_date, due_date: invoice.due_date, tax_rate_pct: invoice.tax_rate * 100 }}
      />
    </div>
  );
}
