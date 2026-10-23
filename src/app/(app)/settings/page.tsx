import { requireContractor } from "@/lib/auth";
import { getStore } from "@/lib/db";
import { isAccountOnboarded } from "@/lib/stripe";
import { signOut } from "@/app/actions";
import { ConnectStripe } from "@/components/connect-stripe";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ stripe?: string }> }) {
  const { stripe: stripeParam } = await searchParams;
  let { contractor } = await requireContractor();

  // Coming back from Stripe onboarding: check status once so the UI is right immediately
  // (the account.updated webhook keeps it right afterwards).
  if (stripeParam && contractor.stripe_account_id && !contractor.stripe_onboarded) {
    const onboarded = await isAccountOnboarded(contractor.stripe_account_id).catch(() => false);
    if (onboarded) contractor = await getStore().updateContractor(contractor.id, { stripe_onboarded: true });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      <section className="card space-y-3">
        <h2 className="font-semibold">Card payments</h2>
        {contractor.stripe_onboarded ? (
          <p className="text-sm text-ok" data-testid="stripe-status">
            ✓ Stripe connected. Customers can pay invoices online; payouts go to your bank.
          </p>
        ) : (
          <>
            <p className="text-sm text-muted" data-testid="stripe-status">
              Connect a Stripe account to take card payments. Stripe verifies your identity and bank; Bill Ready never sees your bank details.
              A {contractor.platform_fee_bps / 100}% platform fee is added to Stripe&apos;s processing fee on each card payment.
            </p>
            <ConnectStripe label={contractor.stripe_account_id ? "Finish Stripe setup" : "Connect Stripe"} />
          </>
        )}
      </section>

      <section className="card">
        <h2 className="mb-3 font-semibold">Business details</h2>
        <SettingsForm contractor={contractor} />
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">QuickBooks Online export</h2>
        <p className="text-sm text-muted">
          CSV files shaped for QuickBooks&apos; built-in importer. Import customers first, then invoices, then payments.
          Customer names must match QuickBooks exactly — set a &ldquo;QuickBooks display name&rdquo; on any customer that differs.
        </p>
        <div className="grid grid-cols-3 gap-2">
          <a className="btn-secondary" href="/api/export?type=customers" download>
            Customers
          </a>
          <a className="btn-secondary" href="/api/export?type=invoices" download>
            Invoices
          </a>
          <a className="btn-secondary" href="/api/export?type=payments" download>
            Payments
          </a>
        </div>
      </section>

      <form action={signOut}>
        <button className="btn-ghost w-full text-muted">Sign out</button>
      </form>
    </div>
  );
}
