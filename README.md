# Bill Ready

Phone-first invoicing for property-maintenance contractors: build the invoice from the truck, email a pay link, get paid by card through Stripe, and hand the bookkeeper QuickBooks-ready CSVs.

**Stack:** Next.js 16 (App Router) · Supabase (auth + Postgres) · Stripe Connect · Resend · Vercel

## What's in v1

- Magic-link sign in; one business per account (team roles are modeled, not exposed yet)
- Customers with a separate "QuickBooks display name" so exports match QBO exactly
- Invoice builder with line items, per-line taxable flag, live totals, notes
- Invoice PDF, email send with pay link, public pay page (no login, long random token)
- Stripe Connect (Express) onboarding; Checkout per invoice; platform fee in basis points (`br_contractors.platform_fee_bps`, default 100 = 1%)
- Webhook marks invoices paid; idempotent on event id *and* payment intent
- Manual payments (check / cash / ACH), partial payments, void
- QBO CSV exports: customers, invoices (one row per line), payments

## Local setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API (project `wpofxgejdlulxjvttgkz`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same page, publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | same page, service role (server only — never expose) |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (use `sk_test_…` until launch) |
| `STRIPE_WEBHOOK_SECRET` | signing secret of the Stripe webhook destination for **Your account** events (payments) |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | signing secret of the destination for **Connected accounts** events (contractor onboarding) |
| `RESEND_API_KEY`, `EMAIL_FROM` | resend.com; `EMAIL_FROM` must be on a verified domain |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally, `https://your-domain` in prod |

### Supabase

The schema is already applied to the project (migration `billready_initial_schema`): tables `br_contractors`, `br_contractor_members`, `br_customers`, `br_services`, `br_invoices`, `br_invoice_lines`, `br_payments`, `br_stripe_events`, with row-level security so a contractor only ever sees their own rows. Totals are recomputed by database triggers whenever lines or payments change, so the numbers can't drift from the data.

Also enable **Authentication → Providers → Email** (magic link) and add `https://your-domain/auth/callback` (and the localhost one) to the redirect allow-list.

### Stripe

1. Turn on **Connect** in the Stripe dashboard and choose Express accounts.
2. Create a webhook endpoint at `https://your-domain/api/stripe/webhook` listening for `checkout.session.completed` and `account.updated`. Tick "Listen to events on Connected accounts" for `account.updated`.
3. Put the signing secret in `STRIPE_WEBHOOK_SECRET`.

Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

## Tests

```bash
npm run lint && npm run typecheck
npm run test:unit   # vitest: money math, QBO export shape, webhook handler (idempotency, partials)
npm run test:e2e    # playwright: full user flow on a Pixel-7 viewport, Stripe + email mocked
```

E2E runs the real production build with `BILLREADY_TEST_MODE=1`, which swaps in an in-memory store, a mock Stripe Checkout, and captured email — no network, no keys, deterministic. The mock checkout posts the same webhook payload Stripe would, so the real handler is exercised. CI (`.github/workflows/ci.yml`) runs all of this on every push and PR.

`npm run dev:test` starts the dev server in that same mode for clicking around without any accounts.

## Deploy (Vercel)

Import the repo, set the env vars above (production Stripe keys only when you're ready), and point `NEXT_PUBLIC_APP_URL` at the Vercel domain. Then update the Stripe webhook endpoint and Supabase redirect URL to match.

## Roadmap (not in v1)

1. Voice → draft invoice (Whisper/Deepgram → Claude → line items)
2. Bulk import of old invoices/PDFs to seed the customer list
3. Stripe Billing for a paid tier
4. QBO API sync (OAuth) instead of CSV
5. Crew accounts, estimates → invoices, reminders for overdue
