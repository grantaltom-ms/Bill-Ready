export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "void";
export type PaymentMethod = "card" | "check" | "cash" | "ach" | "other";

export interface Contractor {
  id: string;
  owner_user_id: string;
  business_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  logo_url: string | null;
  default_tax_rate: number;
  platform_fee_bps: number;
  stripe_account_id: string | null;
  stripe_onboarded: boolean;
  next_invoice_number: number;
  created_at: string;
}

export interface Customer {
  id: string;
  contractor_id: string;
  display_name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  service_address: string | null;
  qbo_display_name: string | null;
  notes: string | null;
  created_at: string;
}

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  contractor_id: string;
  position: number;
  service_id: string | null;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  taxable: boolean;
}

export interface Invoice {
  id: string;
  contractor_id: string;
  customer_id: string;
  invoice_number: number;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  amount_paid: number;
  notes: string | null;
  public_token: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_url: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  contractor_id: string;
  amount: number;
  method: PaymentMethod;
  stripe_payment_intent_id: string | null;
  received_at: string;
  note: string | null;
  created_at: string;
}

export interface InvoiceWithDetails extends Invoice {
  customer: Customer;
  lines: InvoiceLine[];
  payments: Payment[];
}

export interface NewCustomer {
  display_name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  billing_address?: string | null;
  service_address?: string | null;
  qbo_display_name?: string | null;
  notes?: string | null;
}

export interface NewLine {
  description: string;
  quantity: number;
  rate: number;
  taxable: boolean;
}

export interface NewInvoice {
  customer_id: string;
  issue_date: string;
  due_date: string;
  tax_rate: number;
  notes?: string | null;
  lines: NewLine[];
}

export interface NewPayment {
  amount: number;
  method: PaymentMethod;
  stripe_payment_intent_id?: string | null;
  received_at?: string;
  note?: string | null;
}

export interface SessionUser {
  id: string;
  email: string | null;
}
