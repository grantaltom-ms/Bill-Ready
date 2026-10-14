import type {
  Contractor,
  Customer,
  Invoice,
  InvoiceWithDetails,
  NewCustomer,
  NewInvoice,
  NewPayment,
  Payment,
  SessionUser,
} from "@/lib/types";

/**
 * Everything the app needs from the database, behind one interface.
 * Production uses Supabase (RLS-scoped to the signed-in user).
 * Tests use an in-memory store so end-to-end runs are fast, free and deterministic.
 */
export interface Store {
  // --- auth / contractor
  currentUser(): Promise<SessionUser | null>;
  contractorForUser(userId: string): Promise<Contractor | null>;
  createContractor(userId: string, input: { business_name: string; email?: string | null; phone?: string | null; address?: string | null }): Promise<Contractor>;
  updateContractor(id: string, patch: Partial<Pick<Contractor, "business_name" | "email" | "phone" | "address" | "default_tax_rate" | "stripe_account_id" | "stripe_onboarded">>): Promise<Contractor>;

  // --- customers
  listCustomers(contractorId: string): Promise<Customer[]>;
  getCustomer(contractorId: string, id: string): Promise<Customer | null>;
  createCustomer(contractorId: string, input: NewCustomer): Promise<Customer>;
  updateCustomer(contractorId: string, id: string, input: NewCustomer): Promise<Customer>;

  // --- invoices
  listInvoices(contractorId: string): Promise<(Invoice & { customer: Customer })[]>;
  getInvoice(contractorId: string, id: string): Promise<InvoiceWithDetails | null>;
  createInvoice(contractorId: string, input: NewInvoice): Promise<InvoiceWithDetails>;
  updateInvoice(contractorId: string, id: string, input: NewInvoice): Promise<InvoiceWithDetails>;
  setInvoiceStatus(contractorId: string, id: string, status: Invoice["status"], extra?: Partial<Pick<Invoice, "sent_at" | "stripe_checkout_session_id" | "stripe_payment_url">>): Promise<void>;
  addPayment(contractorId: string, invoiceId: string, input: NewPayment): Promise<Payment>;

  // --- unauthenticated / service-role access (public pay page, webhooks)
  getInvoiceByToken(token: string): Promise<(InvoiceWithDetails & { contractor: Contractor }) | null>;
  getInvoiceAdmin(id: string): Promise<(InvoiceWithDetails & { contractor: Contractor }) | null>;
  recordStripeEvent(eventId: string, type: string): Promise<boolean>; // false if already processed
  addPaymentAdmin(invoiceId: string, input: NewPayment): Promise<Payment | null>;
  setInvoiceStatusAdmin(id: string, status: Invoice["status"], extra?: Partial<Pick<Invoice, "sent_at" | "stripe_checkout_session_id" | "stripe_payment_url">>): Promise<void>;
  updateContractorAdmin(id: string, patch: Partial<Pick<Contractor, "stripe_account_id" | "stripe_onboarded">>): Promise<void>;
}
