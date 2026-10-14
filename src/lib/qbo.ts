import type { Customer, Invoice, InvoiceLine, Payment } from "@/lib/types";
import { fmtDateUS } from "@/lib/money";

/**
 * CSV exports shaped for QuickBooks Online's built-in importers.
 *
 * Invoices: one row per line item. Required by QBO: Invoice Number, Customer, Invoice Date,
 * Due Date, Item Amount. Customer must match the QBO display name exactly, and the
 * Item (Product/Service) must already exist in QBO with the same spelling.
 * QBO caps an import file at 1,000 rows, so callers chunk with `chunkRows`.
 */

function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export const INVOICE_HEADERS = [
  "Invoice No",
  "Customer",
  "Invoice Date",
  "Due Date",
  "Item(Product/Service)",
  "ItemDescription",
  "ItemQuantity",
  "ItemRate",
  "ItemAmount",
  "Taxable",
  "Memo",
];

export function qboCustomerName(c: Customer): string {
  return (c.qbo_display_name?.trim() || c.display_name).trim();
}

export function invoiceRows(
  invoices: (Invoice & { customer: Customer; lines: InvoiceLine[] })[],
  defaultItem = "Services",
): (string | number)[][] {
  const rows: (string | number)[][] = [];
  for (const inv of invoices) {
    if (inv.status === "void" || inv.status === "draft") continue;
    for (const l of inv.lines) {
      rows.push([
        inv.invoice_number,
        qboCustomerName(inv.customer),
        fmtDateUS(inv.issue_date),
        fmtDateUS(inv.due_date),
        defaultItem,
        l.description,
        l.quantity,
        l.rate,
        l.amount.toFixed(2),
        l.taxable ? "Y" : "N",
        inv.notes ?? "",
      ]);
    }
  }
  return rows;
}

export const CUSTOMER_HEADERS = ["Name", "Company", "Email", "Phone", "Billing Address", "Shipping Address"];

export function customerRows(customers: Customer[]): (string | null)[][] {
  return customers.map((c) => [
    qboCustomerName(c),
    c.company,
    c.email,
    c.phone,
    c.billing_address,
    c.service_address,
  ]);
}

export const PAYMENT_HEADERS = ["Invoice No", "Customer", "Payment Date", "Amount", "Payment Method", "Reference No", "Memo"];

export function paymentRows(
  payments: (Payment & { invoice: Invoice & { customer: Customer } })[],
): (string | number | null)[][] {
  return payments.map((p) => [
    p.invoice.invoice_number,
    qboCustomerName(p.invoice.customer),
    fmtDateUS(p.received_at.slice(0, 10)),
    p.amount.toFixed(2),
    p.method,
    p.stripe_payment_intent_id,
    p.note,
  ]);
}

/** QBO rejects files over 1,000 rows. */
export const QBO_MAX_ROWS = 1000;

export function chunkRows<T>(rows: T[], size = QBO_MAX_ROWS): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
