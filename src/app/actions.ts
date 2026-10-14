"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getStore } from "@/lib/db";
import { requireContractor, requireUser } from "@/lib/auth";
import { createConnectOnboardingLink, createInvoiceCheckout, appUrl } from "@/lib/stripe";
import { sendInvoiceEmail } from "@/lib/email";
import { supabaseServer } from "@/lib/supabase/server";
import { isTestMode } from "@/lib/db";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const str = (max = 500) => z.string().trim().max(max);
const optStr = (max = 500) => str(max).transform((s) => (s === "" ? null : s)).nullable().optional();

// ---------- auth

export async function sendMagicLink(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const email = z.string().email().safeParse(String(form.get("email") ?? "").trim());
  if (!email.success) return { ok: false, error: "Enter a valid email address" };
  if (isTestMode) {
    revalidatePath("/", "layout");
    redirect("/dashboard");
  }
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: `${appUrl()}/auth/callback` },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: "Check your email for a sign-in link." };
}

export async function signOut() {
  if (!isTestMode) {
    const sb = await supabaseServer();
    await sb.auth.signOut();
  }
  redirect("/login");
}

// ---------- contractor

const contractorSchema = z.object({
  business_name: str(120).min(1, "Business name is required"),
  email: optStr(200),
  phone: optStr(40),
  address: optStr(400),
});

export async function createContractorAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = contractorSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const store = getStore();
  const existing = await store.contractorForUser(user.id);
  if (!existing) await store.createContractor(user.id, parsed.data);
  revalidatePath("/", "layout"); // the app layout's "no business yet → onboarding" decision is now stale
  redirect("/dashboard");
}

export async function updateSettingsAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { contractor } = await requireContractor();
  const parsed = contractorSchema
    .extend({ default_tax_rate: z.coerce.number().min(0).max(100) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { default_tax_rate, ...rest } = parsed.data;
  await getStore().updateContractor(contractor.id, { ...rest, default_tax_rate: default_tax_rate / 100 });
  revalidatePath("/settings");
  return { ok: true, message: "Saved" };
}

export async function startStripeOnboarding() {
  const { contractor } = await requireContractor();
  const { accountId, url } = await createConnectOnboardingLink(contractor);
  if (accountId !== contractor.stripe_account_id) {
    await getStore().updateContractor(contractor.id, { stripe_account_id: accountId });
  }
  redirect(url);
}

// ---------- customers

const customerSchema = z.object({
  display_name: str(120).min(1, "Name is required"),
  company: optStr(120),
  email: optStr(200),
  phone: optStr(40),
  billing_address: optStr(400),
  service_address: optStr(400),
  qbo_display_name: optStr(120),
  notes: optStr(2000),
});

export async function saveCustomerAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { contractor } = await requireContractor();
  const parsed = customerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const id = String(form.get("id") ?? "");
  const store = getStore();
  const c = id
    ? await store.updateCustomer(contractor.id, id, parsed.data)
    : await store.createCustomer(contractor.id, parsed.data);
  revalidatePath("/customers");
  const next = String(form.get("next") ?? "");
  redirect(next ? `${next}?customer=${c.id}` : `/customers/${c.id}`);
}

// ---------- invoices

const lineSchema = z.object({
  description: str(500).min(1, "Each line needs a description"),
  quantity: z.coerce.number().positive("Quantity must be greater than 0"),
  rate: z.coerce.number().min(0),
  taxable: z.boolean(),
});

const invoiceSchema = z.object({
  customer_id: z.string().min(1, "Pick a customer"),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invoice date is required"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date is required"),
  tax_rate: z.coerce.number().min(0).max(100),
  notes: optStr(2000),
  lines: z.array(lineSchema).min(1, "Add at least one line item"),
});

function parseLines(form: FormData) {
  const descs = form.getAll("line_description").map(String);
  const qtys = form.getAll("line_quantity").map(String);
  const rates = form.getAll("line_rate").map(String);
  const taxIdx = new Set(form.getAll("line_taxable").map(String));
  return descs
    .map((description, i) => ({
      description,
      quantity: qtys[i],
      rate: rates[i],
      taxable: taxIdx.has(String(i)),
    }))
    .filter((l) => l.description.trim() !== "" || l.rate.trim() !== "");
}

export async function saveInvoiceAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { contractor } = await requireContractor();
  const parsed = invoiceSchema.safeParse({
    customer_id: form.get("customer_id"),
    issue_date: form.get("issue_date"),
    due_date: form.get("due_date"),
    tax_rate: form.get("tax_rate"),
    notes: form.get("notes"),
    lines: parseLines(form),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const input = { ...parsed.data, tax_rate: parsed.data.tax_rate / 100 };
  const id = String(form.get("id") ?? "");
  const store = getStore();
  const inv = id
    ? await store.updateInvoice(contractor.id, id, input)
    : await store.createInvoice(contractor.id, input);
  revalidatePath("/invoices");
  redirect(`/invoices/${inv.id}`);
}

export async function sendInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const { contractor } = await requireContractor();
  const store = getStore();
  const inv = await store.getInvoice(contractor.id, invoiceId);
  if (!inv) return { ok: false, error: "Invoice not found" };
  if (inv.status === "void") return { ok: false, error: "Invoice is void" };
  const payUrl = `${appUrl()}/pay/${inv.public_token}`;
  const res = await sendInvoiceEmail({ ...inv, contractor }, payUrl);
  if (!res.ok) return res;
  if (inv.status === "draft") {
    await store.setInvoiceStatus(contractor.id, invoiceId, "sent", { sent_at: new Date().toISOString() });
  }
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { ok: true, message: `Sent to ${inv.customer.email}` };
}

export async function markSentAction(invoiceId: string): Promise<ActionResult> {
  const { contractor } = await requireContractor();
  await getStore().setInvoiceStatus(contractor.id, invoiceId, "sent", { sent_at: new Date().toISOString() });
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { ok: true };
}

export async function voidInvoiceAction(invoiceId: string): Promise<ActionResult> {
  const { contractor } = await requireContractor();
  await getStore().setInvoiceStatus(contractor.id, invoiceId, "void");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { ok: true };
}

const paymentSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  method: z.enum(["card", "check", "cash", "ach", "other"]),
  received_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: optStr(500),
});

export async function recordPaymentAction(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const { contractor } = await requireContractor();
  const invoiceId = String(form.get("invoice_id") ?? "");
  const parsed = paymentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await getStore().addPayment(contractor.id, invoiceId, {
    amount: parsed.data.amount,
    method: parsed.data.method,
    received_at: new Date(parsed.data.received_at + "T12:00:00Z").toISOString(),
    note: parsed.data.note ?? null,
  });
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { ok: true, message: "Payment recorded" };
}

/** Public pay page → Stripe Checkout. Uses the invoice's public token, not a login. */
export async function startCheckoutAction(token: string) {
  const store = getStore();
  const inv = await store.getInvoiceByToken(token);
  if (!inv) redirect("/");
  const { sessionId, url } = await createInvoiceCheckout(inv);
  await store.setInvoiceStatusAdmin(inv.id, inv.status === "draft" ? "sent" : inv.status, {
    stripe_checkout_session_id: sessionId,
    stripe_payment_url: url,
  });
  redirect(url);
}
