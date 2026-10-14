import type { SupabaseClient } from "@supabase/supabase-js";
import type { Store } from "./store";
import type {
  Contractor,
  Customer,
  Invoice,
  InvoiceLine,
  InvoiceWithDetails,
  NewInvoice,
  Payment,
} from "@/lib/types";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { round2 } from "@/lib/money";

// Postgres returns numeric columns as strings; normalize to numbers once, here.
const NUM_INVOICE = ["subtotal", "tax_rate", "tax_amount", "total", "amount_paid"] as const;
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

function invoiceRow(r: Record<string, unknown>): Invoice {
  const out = { ...r } as Record<string, unknown>;
  for (const k of NUM_INVOICE) out[k] = num(r[k]);
  return out as unknown as Invoice;
}
function lineRow(r: Record<string, unknown>): InvoiceLine {
  return { ...r, quantity: num(r.quantity), rate: num(r.rate), amount: num(r.amount) } as InvoiceLine;
}
function paymentRow(r: Record<string, unknown>): Payment {
  return { ...r, amount: num(r.amount) } as Payment;
}
function contractorRow(r: Record<string, unknown>): Contractor {
  return { ...r, default_tax_rate: num(r.default_tax_rate) } as Contractor;
}

function fail(msg: string, err: { message: string } | null): never {
  throw new Error(`${msg}: ${err?.message ?? "unknown error"}`);
}

async function loadDetails(
  sb: SupabaseClient,
  inv: Invoice,
): Promise<InvoiceWithDetails> {
  const [{ data: customer }, { data: lines }, { data: payments }] = await Promise.all([
    sb.from("br_customers").select("*").eq("id", inv.customer_id).single(),
    sb.from("br_invoice_lines").select("*").eq("invoice_id", inv.id).order("position"),
    sb.from("br_payments").select("*").eq("invoice_id", inv.id).order("received_at"),
  ]);
  return {
    ...inv,
    customer: customer as Customer,
    lines: (lines ?? []).map(lineRow),
    payments: (payments ?? []).map(paymentRow),
  };
}

async function writeLines(sb: SupabaseClient, inv: Invoice, input: NewInvoice) {
  const { error: delErr } = await sb.from("br_invoice_lines").delete().eq("invoice_id", inv.id);
  if (delErr) fail("Could not clear invoice lines", delErr);
  if (input.lines.length === 0) return;
  const rows = input.lines.map((l, i) => ({
    invoice_id: inv.id,
    contractor_id: inv.contractor_id,
    position: i,
    description: l.description,
    quantity: l.quantity,
    rate: l.rate,
    amount: round2(l.quantity * l.rate),
    taxable: l.taxable,
  }));
  const { error } = await sb.from("br_invoice_lines").insert(rows);
  if (error) fail("Could not save invoice lines", error);
}

async function refetchInvoice(sb: SupabaseClient, id: string): Promise<InvoiceWithDetails> {
  const { data, error } = await sb.from("br_invoices").select("*").eq("id", id).single();
  if (error) fail("Could not load invoice", error);
  return loadDetails(sb, invoiceRow(data));
}

export const supabaseStore: Store = {
  async currentUser() {
    const sb = await supabaseServer();
    const { data } = await sb.auth.getUser();
    return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
  },

  async contractorForUser(userId) {
    const sb = await supabaseServer();
    const { data } = await sb
      .from("br_contractor_members")
      .select("contractor_id, br_contractors(*)")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    const c = (data as { br_contractors?: Record<string, unknown> } | null)?.br_contractors;
    return c ? contractorRow(c) : null;
  },

  async createContractor(userId, input) {
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("br_contractors")
      .insert({ owner_user_id: userId, ...input })
      .select("*")
      .single();
    if (error) fail("Could not create business", error);
    return contractorRow(data);
  },

  async updateContractor(id, patch) {
    const sb = await supabaseServer();
    const { data, error } = await sb.from("br_contractors").update(patch).eq("id", id).select("*").single();
    if (error) fail("Could not update business", error);
    return contractorRow(data);
  },

  async listCustomers(contractorId) {
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("br_customers")
      .select("*")
      .eq("contractor_id", contractorId)
      .order("display_name");
    if (error) fail("Could not list customers", error);
    return data as Customer[];
  },

  async getCustomer(contractorId, id) {
    const sb = await supabaseServer();
    const { data } = await sb
      .from("br_customers")
      .select("*")
      .eq("contractor_id", contractorId)
      .eq("id", id)
      .maybeSingle();
    return (data as Customer) ?? null;
  },

  async createCustomer(contractorId, input) {
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("br_customers")
      .insert({ contractor_id: contractorId, ...input })
      .select("*")
      .single();
    if (error) fail("Could not create customer", error);
    return data as Customer;
  },

  async updateCustomer(contractorId, id, input) {
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("br_customers")
      .update(input)
      .eq("contractor_id", contractorId)
      .eq("id", id)
      .select("*")
      .single();
    if (error) fail("Could not update customer", error);
    return data as Customer;
  },

  async listInvoices(contractorId) {
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("br_invoices")
      .select("*, customer:br_customers(*)")
      .eq("contractor_id", contractorId)
      .order("invoice_number", { ascending: false });
    if (error) fail("Could not list invoices", error);
    return (data ?? []).map((r) => {
      const { customer, ...rest } = r as Record<string, unknown> & { customer: Customer };
      return { ...invoiceRow(rest), customer };
    });
  },

  async getInvoice(contractorId, id) {
    const sb = await supabaseServer();
    const { data } = await sb
      .from("br_invoices")
      .select("*")
      .eq("contractor_id", contractorId)
      .eq("id", id)
      .maybeSingle();
    if (!data) return null;
    return loadDetails(sb, invoiceRow(data));
  },

  async createInvoice(contractorId, input) {
    const sb = await supabaseServer();
    const { data: n, error: nErr } = await sb.rpc("br_next_invoice_number", { c: contractorId });
    if (nErr) fail("Could not assign invoice number", nErr);
    const { data, error } = await sb
      .from("br_invoices")
      .insert({
        contractor_id: contractorId,
        customer_id: input.customer_id,
        invoice_number: n,
        issue_date: input.issue_date,
        due_date: input.due_date,
        tax_rate: input.tax_rate,
        notes: input.notes ?? null,
      })
      .select("*")
      .single();
    if (error) fail("Could not create invoice", error);
    const inv = invoiceRow(data);
    await writeLines(sb, inv, input);
    return refetchInvoice(sb, inv.id);
  },

  async updateInvoice(contractorId, id, input) {
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("br_invoices")
      .update({
        customer_id: input.customer_id,
        issue_date: input.issue_date,
        due_date: input.due_date,
        tax_rate: input.tax_rate,
        notes: input.notes ?? null,
      })
      .eq("contractor_id", contractorId)
      .eq("id", id)
      .select("*")
      .single();
    if (error) fail("Could not update invoice", error);
    const inv = invoiceRow(data);
    await writeLines(sb, inv, input);
    // Lines trigger recalculates totals, but a tax-rate-only change needs a nudge.
    await sb.rpc("br_recalc_invoice", { inv: inv.id });
    return refetchInvoice(sb, inv.id);
  },

  async setInvoiceStatus(contractorId, id, status, extra) {
    const sb = await supabaseServer();
    const { error } = await sb
      .from("br_invoices")
      .update({ status, ...(extra ?? {}) })
      .eq("contractor_id", contractorId)
      .eq("id", id);
    if (error) fail("Could not update invoice status", error);
  },

  async addPayment(contractorId, invoiceId, input) {
    const sb = await supabaseServer();
    const { data, error } = await sb
      .from("br_payments")
      .insert({ contractor_id: contractorId, invoice_id: invoiceId, ...input })
      .select("*")
      .single();
    if (error) fail("Could not record payment", error);
    return paymentRow(data);
  },

  // ---- service-role paths

  async getInvoiceByToken(token) {
    const sb = supabaseAdmin();
    const { data } = await sb.from("br_invoices").select("*").eq("public_token", token).maybeSingle();
    if (!data) return null;
    const inv = invoiceRow(data);
    const [details, { data: contractor }] = await Promise.all([
      loadDetails(sb, inv),
      sb.from("br_contractors").select("*").eq("id", inv.contractor_id).single(),
    ]);
    return { ...details, contractor: contractorRow(contractor) };
  },

  async getInvoiceAdmin(id) {
    const sb = supabaseAdmin();
    const { data } = await sb.from("br_invoices").select("*").eq("id", id).maybeSingle();
    if (!data) return null;
    const inv = invoiceRow(data);
    const [details, { data: contractor }] = await Promise.all([
      loadDetails(sb, inv),
      sb.from("br_contractors").select("*").eq("id", inv.contractor_id).single(),
    ]);
    return { ...details, contractor: contractorRow(contractor) };
  },

  async recordStripeEvent(eventId, type) {
    const sb = supabaseAdmin();
    const { error } = await sb.from("br_stripe_events").insert({ id: eventId, type });
    if (error && error.code === "23505") return false; // already processed
    if (error) fail("Could not record Stripe event", error);
    return true;
  },

  async addPaymentAdmin(invoiceId, input) {
    const sb = supabaseAdmin();
    const { data: inv } = await sb.from("br_invoices").select("contractor_id").eq("id", invoiceId).maybeSingle();
    if (!inv) return null;
    const { data, error } = await sb
      .from("br_payments")
      .insert({ contractor_id: inv.contractor_id, invoice_id: invoiceId, ...input })
      .select("*")
      .single();
    if (error && error.code === "23505") {
      const { data: existing } = await sb
        .from("br_payments")
        .select("*")
        .eq("stripe_payment_intent_id", input.stripe_payment_intent_id!)
        .single();
      return paymentRow(existing);
    }
    if (error) fail("Could not record payment", error);
    return paymentRow(data);
  },

  async setInvoiceStatusAdmin(id, status, extra) {
    const sb = supabaseAdmin();
    await sb.from("br_invoices").update({ status, ...(extra ?? {}) }).eq("id", id);
  },

  async updateContractorAdmin(id, patch) {
    const sb = supabaseAdmin();
    await sb.from("br_contractors").update(patch).eq("id", id);
  },
};
