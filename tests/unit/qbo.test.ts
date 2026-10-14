import { describe, expect, it } from "vitest";
import { INVOICE_HEADERS, chunkRows, customerRows, invoiceRows, qboCustomerName, toCsv } from "@/lib/qbo";
import type { Customer, Invoice, InvoiceLine } from "@/lib/types";

const customer: Customer = {
  id: "c1", contractor_id: "k1", display_name: "Bob Henderson", company: "Henderson, LLC", email: "bob@x.com",
  phone: null, billing_address: null, service_address: "12 Main St", qbo_display_name: null, notes: null, created_at: "",
};
const base: Invoice = {
  id: "i1", contractor_id: "k1", customer_id: "c1", invoice_number: 1001, status: "sent", issue_date: "2026-10-14",
  due_date: "2026-11-13", subtotal: 310, tax_rate: 0.1035, tax_amount: 14.49, total: 324.49, amount_paid: 0,
  notes: 'Thanks, "Bob"', public_token: "t", stripe_checkout_session_id: null, stripe_payment_url: null,
  sent_at: null, paid_at: null, created_at: "", updated_at: "",
};
const lines: InvoiceLine[] = [
  { id: "l1", invoice_id: "i1", contractor_id: "k1", position: 0, service_id: null, description: "Labor, 2 hrs", quantity: 2, rate: 85, amount: 170, taxable: false },
  { id: "l2", invoice_id: "i1", contractor_id: "k1", position: 1, service_id: null, description: "Disposal unit", quantity: 1, rate: 140, amount: 140, taxable: true },
];

describe("QuickBooks export", () => {
  it("prefers the QBO display name when set", () => {
    expect(qboCustomerName(customer)).toBe("Bob Henderson");
    expect(qboCustomerName({ ...customer, qbo_display_name: "Henderson, Bob" })).toBe("Henderson, Bob");
  });

  it("emits one row per line with required QBO columns and US dates", () => {
    const rows = invoiceRows([{ ...base, customer, lines }]);
    expect(rows).toHaveLength(2);
    const csv = toCsv(INVOICE_HEADERS, rows);
    const [header, r1] = csv.split("\r\n");
    expect(header.startsWith("Invoice No,Customer,Invoice Date,Due Date,Item(Product/Service)")).toBe(true);
    expect(r1).toContain("1001,Bob Henderson,10/14/2026,11/13/2026,Services,\"Labor, 2 hrs\",2,85,170.00,N");
    expect(r1).toContain('"Thanks, ""Bob"""'); // quotes escaped
  });

  it("skips drafts and voids", () => {
    expect(invoiceRows([{ ...base, status: "draft", customer, lines }])).toHaveLength(0);
    expect(invoiceRows([{ ...base, status: "void", customer, lines }])).toHaveLength(0);
  });

  it("quotes company names with commas", () => {
    const csv = toCsv(["Name", "Company"], customerRows([customer]).map((r) => r.slice(0, 2)));
    expect(csv).toContain('Bob Henderson,"Henderson, LLC"');
  });

  it("chunks at QuickBooks' 1,000-row limit", () => {
    const big = Array.from({ length: 2500 }, (_, i) => [i]);
    const chunks = chunkRows(big);
    expect(chunks.map((c) => c.length)).toEqual([1000, 1000, 500]);
  });
});
