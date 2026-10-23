import Stripe from "stripe";
import { isTestMode } from "@/lib/db";
import { toCents } from "@/lib/money";
import type { Contractor, InvoiceWithDetails } from "@/lib/types";

export function stripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Stripe Connect via Accounts v2: each contractor gets a connected account with the
 * "recipient" configuration (receives transfers from our destination charges).
 * Returns a one-time Stripe-hosted onboarding URL to send the contractor to.
 */
export async function createConnectOnboardingLink(contractor: Contractor): Promise<{ accountId: string; url: string }> {
  if (isTestMode) {
    return { accountId: contractor.stripe_account_id ?? "acct_test_123", url: `${appUrl()}/settings?stripe=onboarded` };
  }
  const s = stripe();
  let accountId = contractor.stripe_account_id;
  if (!accountId) {
    const account = await s.v2.core.accounts.create({
      display_name: contractor.business_name,
      contact_email: contractor.email ?? undefined,
      identity: { country: "US" },
      dashboard: "express",
      defaults: {
        currency: "usd",
        responsibilities: { fees_collector: "application", losses_collector: "application" },
      },
      configuration: {
        recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } },
      },
      metadata: { contractor_id: contractor.id },
    });
    accountId = account.id;
  }
  const link = await s.v2.core.accountLinks.create({
    account: accountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        refresh_url: `${appUrl()}/settings?stripe=refresh`,
        return_url: `${appUrl()}/settings?stripe=return`,
      },
    },
  });
  return { accountId, url: link.url };
}

/** True once the contractor can receive transfers (the capability our destination charges need). */
export async function isAccountOnboarded(accountId: string): Promise<boolean> {
  if (isTestMode) return true;
  const acct = await stripe().v2.core.accounts.retrieve(accountId, { include: ["configuration.recipient"] });
  return acct.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === "active";
}

/**
 * A Checkout Session for one invoice. Money goes to the contractor's connected account;
 * the platform fee (basis points) is taken automatically.
 */
export async function createInvoiceCheckout(
  inv: InvoiceWithDetails & { contractor: Contractor },
): Promise<{ sessionId: string; url: string }> {
  const amountDue = inv.total - inv.amount_paid;
  if (amountDue <= 0) throw new Error("Invoice has no balance due");
  if (isTestMode) {
    return { sessionId: `cs_test_${inv.id.slice(0, 8)}`, url: `${appUrl()}/pay/${inv.public_token}?mock_checkout=1` };
  }
  if (!inv.contractor.stripe_account_id || !inv.contractor.stripe_onboarded) {
    throw new Error("Connect a Stripe account in Settings before taking card payments");
  }
  const cents = toCents(amountDue);
  const fee = Math.round((cents * inv.contractor.platform_fee_bps) / 10_000);
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: cents,
          product_data: {
            name: `Invoice #${inv.invoice_number} — ${inv.contractor.business_name}`,
            description: inv.customer.display_name,
          },
        },
      },
    ],
    customer_email: inv.customer.email ?? undefined,
    payment_intent_data: {
      application_fee_amount: fee,
      transfer_data: { destination: inv.contractor.stripe_account_id },
      metadata: { invoice_id: inv.id, contractor_id: inv.contractor_id },
    },
    metadata: { invoice_id: inv.id, contractor_id: inv.contractor_id },
    success_url: `${appUrl()}/pay/${inv.public_token}?paid=1`,
    cancel_url: `${appUrl()}/pay/${inv.public_token}`,
  });
  return { sessionId: session.id, url: session.url! };
}

/** Verify a webhook signature and return the event. In test mode, trust the JSON body. */
export function parseWebhookEvent(rawBody: string, signature: string | null): Stripe.Event {
  if (isTestMode) return JSON.parse(rawBody) as Stripe.Event;
  // Two Stripe destinations post here: one for the platform account (payments) and one for
  // connected accounts (contractor onboarding). Each has its own signing secret; accept either.
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(
    (s): s is string => Boolean(s),
  );
  if (secrets.length === 0) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  if (!signature) throw new Error("Missing stripe-signature header");
  let lastErr: unknown;
  for (const secret of secrets) {
    try {
      return stripe().webhooks.constructEvent(rawBody, signature, secret);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}
