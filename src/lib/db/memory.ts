import { randomUUID, randomBytes } from "node:crypto";
import type { Store } from "./store";
import type {
  Contractor,
  Customer,
  Invoice,
  InvoiceLine,
  InvoiceWithDetails,
  NewInvoice,
  Payment,
  SessionUser,
} from "@/lib/types";
import { computeTotals, round2 } from "@/lib/money";

/**
 * In-memory store used when BILLREADY_TEST_MODE=1.
 * Mirrors the Postgres triggers (totals recalculated from lines + payments).
 * State lives on globalThis so it survives Next.js module reloads in dev/test.
 */
interface State {
  user: SessionUser;
  contractors: Contractor[];
  customers: Customer[];
  invoices: Invoice[];
  lines: InvoiceLine[];
  payments: Payment[];
  stripeEvents: Set<string>;
}

declare global {
  var __billreadyMemoryState: State | undefined;
}

function state(): State {
  if (!globalThis.__billreadyMemoryState) {
    globalThis.__billreadyMemoryState = {
      user: { id: "test-user-1", email: "tester@example.com" },
      contractors: [],
      customers: [],
      invoices: [],
      lines: [],
      payments: [],
      stripeEvents: new Set(),
    };
  }
  return globalThis.__billreadyMemoryState;
}

export function resetMemoryStore() {
  globalThis.__billreadyMemoryState = undefined;
}

const now = () => new Date().toISOString();

function recalc(inv: Invoice) {
  const s = state();
  const lines = s.lines.filter((l) => l.invoice_id === inv.id);
  const t = computeTotals({ lines, taxRate: inv.tax_rate });
  const paid = round2(
    s.payments.filter((p) => p.invoice_id === inv.id).reduce((a, p) => a + p.amount, 0),
  );
  inv.subtotal = t.subtotal;
  inv.tax_amount = t.tax_amount;
  inv.total = t.total;
  inv.amount_paid = paid;
  if (inv.status !== "void") {
    if (paid >= inv.total && inv.total > 0) {
      inv.status = "paid";
      inv.paid_at = inv.paid_at ?? now();
    } else if (inv.status === "paid") {
      inv.status = "sent";
      inv.paid_at = null;
    }
  }
  inv.updated_at = now();
}

function details(inv: Invoice): InvoiceWithDetails {
  const s = state();
  return {
    ...inv,
    customer: s.customers.find((c) => c.id === inv.customer_id)!,
    lines: s.lines.filter((l) => l.invoice_id === inv.id).sort((a, b) => a.position - b.position),
    payments: s.payments.filter((p) => p.invoice_id === inv.id),
  };
}

function replaceLines(inv: Invoice, input: NewInvoice) {
  const s = state();
  s.lines = s.lines.filter((l) => l.invoice_id !== inv.id);
  input.lines.forEach((l, i) => {
    s.lines.push({
      id: randomUUID(),
      invoice_id: inv.id,
      contractor_id: inv.contractor_id,
      position: i,
      service_id: null,
      description: l.description,
      quantity: l.quantity,
      rate: l.rate,
      amount: round2(l.quantity * l.rate),
      taxable: l.taxable,
    });
  });
}

export const memoryStore: Store = {
  async currentUser() {
    return state().user;
  },
  async contractorForUser(userId) {
    return state().contractors.find((c) => c.owner_user_id === userId) ?? null;
  },
  async createContractor(userId, input) {
    const c: Contractor = {
      id: randomUUID(),
      owner_user_id: userId,
      business_name: input.business_name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      logo_url: null,
      default_tax_rate: 0,
      platform_fee_bps: 100,
      stripe_account_id: null,
      stripe_onboarded: false,
      next_invoice_number: 1001,
      created_at: now(),
    };
    state().contractors.push(c);
    return c;
  },
  async updateContractor(id, patch) {
    const c = state().contractors.find((x) => x.id === id)!;
    Object.assign(c, patch);
    return c;
  },
  async listCustomers(contractorId) {
    return state()
      .customers.filter((c) => c.contractor_id === contractorId)
      .sort((a, b) => a.display_name.localeCompare(b.display_name));
  },
  async getCustomer(contractorId, id) {
    return state().customers.find((c) => c.id === id && c.contractor_id === contractorId) ?? null;
  },
  async createCustomer(contractorId, input) {
    const c: Customer = {
      id: randomUUID(),
      contractor_id: contractorId,
      display_name: input.display_name,
      company: input.company ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      billing_address: input.billing_address ?? null,
      service_address: input.service_address ?? null,
      qbo_display_name: input.qbo_display_name ?? null,
      notes: input.notes ?? null,
      created_at: now(),
    };
    state().customers.push(c);
    return c;
  },
  async updateCustomer(contractorId, id, input) {
    const c = state().customers.find((x) => x.id === id && x.contractor_id === contractorId);
    if (!c) throw new Error("Customer not found");
    Object.assign(c, {
      display_name: input.display_name,
      company: input.company ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      billing_address: input.billing_address ?? null,
      service_address: input.service_address ?? null,
      qbo_display_name: input.qbo_display_name ?? null,
      notes: input.notes ?? null,
    });
    return c;
  },
  async listInvoices(contractorId) {
    const s = state();
    return s.invoices
      .filter((i) => i.contractor_id === contractorId)
      .sort((a, b) => b.invoice_number - a.invoice_number)
      .map((i) => ({ ...i, customer: s.customers.find((c) => c.id === i.customer_id)! }));
  },
  async getInvoice(contractorId, id) {
    const inv = state().invoices.find((i) => i.id === id && i.contractor_id === contractorId);
    return inv ? details(inv) : null;
  },
  async createInvoice(contractorId, input) {
    const s = state();
    const contractor = s.contractors.find((c) => c.id === contractorId)!;
    const number = contractor.next_invoice_number++;
    const inv: Invoice = {
      id: randomUUID(),
      contractor_id: contractorId,
      customer_id: input.customer_id,
      invoice_number: number,
      status: "draft",
      issue_date: input.issue_date,
      due_date: input.due_date,
      subtotal: 0,
      tax_rate: input.tax_rate,
      tax_amount: 0,
      total: 0,
      amount_paid: 0,
      notes: input.notes ?? null,
      public_token: randomBytes(18).toString("hex"),
      stripe_checkout_session_id: null,
      stripe_payment_url: null,
      sent_at: null,
      paid_at: null,
      created_at: now(),
      updated_at: now(),
    };
    s.invoices.push(inv);
    replaceLines(inv, input);
    recalc(inv);
    return details(inv);
  },
  async updateInvoice(contractorId, id, input) {
    const inv = state().invoices.find((i) => i.id === id && i.contractor_id === contractorId);
    if (!inv) throw new Error("Invoice not found");
    inv.customer_id = input.customer_id;
    inv.issue_date = input.issue_date;
    inv.due_date = input.due_date;
    inv.tax_rate = input.tax_rate;
    inv.notes = input.notes ?? null;
    replaceLines(inv, input);
    recalc(inv);
    return details(inv);
  },
  async setInvoiceStatus(contractorId, id, status, extra) {
    const inv = state().invoices.find((i) => i.id === id && i.contractor_id === contractorId);
    if (!inv) throw new Error("Invoice not found");
    inv.status = status;
    Object.assign(inv, extra ?? {});
    inv.updated_at = now();
  },
  async addPayment(contractorId, invoiceId, input) {
    const inv = state().invoices.find((i) => i.id === invoiceId && i.contractor_id === contractorId);
    if (!inv) throw new Error("Invoice not found");
    return (await memoryStore.addPaymentAdmin(invoiceId, input))!;
  },
  async getInvoiceByToken(token) {
    const inv = state().invoices.find((i) => i.public_token === token);
    if (!inv) return null;
    const contractor = state().contractors.find((c) => c.id === inv.contractor_id)!;
    return { ...details(inv), contractor };
  },
  async getInvoiceAdmin(id) {
    const inv = state().invoices.find((i) => i.id === id);
    if (!inv) return null;
    const contractor = state().contractors.find((c) => c.id === inv.contractor_id)!;
    return { ...details(inv), contractor };
  },
  async recordStripeEvent(eventId) {
    const s = state();
    if (s.stripeEvents.has(eventId)) return false;
    s.stripeEvents.add(eventId);
    return true;
  },
  async addPaymentAdmin(invoiceId, input) {
    const s = state();
    const inv = s.invoices.find((i) => i.id === invoiceId);
    if (!inv) return null;
    if (
      input.stripe_payment_intent_id &&
      s.payments.some((p) => p.stripe_payment_intent_id === input.stripe_payment_intent_id)
    ) {
      return s.payments.find((p) => p.stripe_payment_intent_id === input.stripe_payment_intent_id)!;
    }
    const p: Payment = {
      id: randomUUID(),
      invoice_id: invoiceId,
      contractor_id: inv.contractor_id,
      amount: round2(input.amount),
      method: input.method,
      stripe_payment_intent_id: input.stripe_payment_intent_id ?? null,
      received_at: input.received_at ?? now(),
      note: input.note ?? null,
      created_at: now(),
    };
    s.payments.push(p);
    recalc(inv);
    return p;
  },
  async setInvoiceStatusAdmin(id, status, extra) {
    const inv = state().invoices.find((i) => i.id === id);
    if (!inv) return;
    inv.status = status;
    Object.assign(inv, extra ?? {});
    inv.updated_at = now();
  },
  async updateContractorAdmin(id, patch) {
    const c = state().contractors.find((x) => x.id === id);
    if (c) Object.assign(c, patch);
  },
};
