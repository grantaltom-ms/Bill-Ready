export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { requireContractor } from "@/lib/auth";
import {
  CUSTOMER_HEADERS,
  INVOICE_HEADERS,
  PAYMENT_HEADERS,
  customerRows,
  invoiceRows,
  paymentRows,
  toCsv,
} from "@/lib/qbo";
import type { Customer, Invoice, Payment } from "@/lib/types";

/** CSV downloads shaped for QuickBooks Online's importer. ?type=customers|invoices|payments */
export async function GET(request: Request) {
  const { contractor } = await requireContractor();
  const type = new URL(request.url).searchParams.get("type") ?? "invoices";
  const store = getStore();
  const stamp = new Date().toISOString().slice(0, 10);
  let csv: string;

  if (type === "customers") {
    csv = toCsv(CUSTOMER_HEADERS, customerRows(await store.listCustomers(contractor.id)));
  } else {
    const list = await store.listInvoices(contractor.id);
    const full = (await Promise.all(list.map((i) => store.getInvoice(contractor.id, i.id)))).filter(Boolean);
    if (type === "payments") {
      const rows: (Payment & { invoice: Invoice & { customer: Customer } })[] = [];
      for (const inv of full) for (const p of inv!.payments) rows.push({ ...p, invoice: inv! });
      csv = toCsv(PAYMENT_HEADERS, paymentRows(rows));
    } else {
      csv = toCsv(INVOICE_HEADERS, invoiceRows(full.map((i) => i!)));
    }
  }
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="billready-${type}-${stamp}.csv"`,
    },
  });
}
