import { expect, test, type Page } from "@playwright/test";

/**
 * Core flow: sign in → set up business → add customer → build invoice → email it →
 * customer pays via (mock) Stripe Checkout → webhook marks it paid → QuickBooks CSV export.
 * Then repeat with several more invoices, a partial check payment, and an edit, because
 * the bugs that matter show up on the fifth invoice, not the first.
 */

const BUSINESS = "Henderson Plumbing LLC";

/** Wait until React has attached the server action, then click. */
async function submit(page: Page, name: string) {
  const btn = page.getByRole("button", { name });
  await expect(btn).toHaveAttribute("data-hydrated", "true");
  await btn.click();
}

test.beforeAll(async ({ request }) => {
  await request.post("/api/test/reset");
});

async function addCustomer(page: Page, name: string, email: string) {
  await page.goto("/customers/new");
  await page.getByLabel("Name", { exact: true }).fill(name);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Service address").fill("3201 Hillside Ave, Seattle, WA 98144");
  await submit(page, "Save customer");
  await expect(page).toHaveURL(/\/customers\/[0-9a-f-]+$/);
  return page.url().split("/").pop()!;
}

async function createInvoice(
  page: Page,
  customerId: string,
  lines: { desc: string; qty: string; rate: string; taxable?: boolean }[],
  taxPct = "10.35",
) {
  await page.goto(`/invoices/new?customer=${customerId}`);
  await expect(page.getByLabel("Customer", { exact: true })).toHaveValue(customerId);
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) await page.getByRole("button", { name: "+ Add line" }).click();
    const n = i + 1;
    await page.getByLabel(`Line ${n} description`).fill(lines[i].desc);
    await page.getByLabel(`Line ${n} quantity`).fill(lines[i].qty);
    await page.getByLabel(`Line ${n} rate`).fill(lines[i].rate);
    if (lines[i].taxable) await page.locator('input[name="line_taxable"]').nth(i).check();
  }
  await page.locator("#tax_rate").fill(taxPct);
  await submit(page, "Save invoice");
  await expect(page).toHaveURL(/\/invoices\/[0-9a-f-]+$/);
  return page.url().split("/").pop()!;
}

async function payLink(page: Page): Promise<string> {
  // The pay link is what gets emailed; grab it via the copy button's fallback-free path:
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy pay link" }).click();
  await expect(page.getByRole("status")).toContainText("Payment link copied");
  return page.evaluate(() => navigator.clipboard.readText());
}

test.describe.configure({ mode: "serial" });

test("contractor signs in, invoices a customer, gets paid, exports to QuickBooks", async ({ page }) => {
  // --- sign in (test mode skips the magic link)
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("bob@hendersonplumbing.com");
  await submit(page, "Email me a sign-in link");

  // --- onboarding
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel("Business name").fill(BUSINESS);
  await page.getByLabel("Phone").fill("206-555-0100");
  await submit(page, "Continue");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("banner")).toContainText(BUSINESS);

  // --- empty state nudges toward a customer
  await page.goto("/invoices/new");
  await expect(page.getByRole("link", { name: "Add your first customer" })).toBeVisible();

  // --- connect Stripe (mocked: returns straight to settings as onboarded)
  await page.goto("/settings");
  await expect(page.getByTestId("stripe-status")).toContainText("Connect a Stripe account");
  await page.getByRole("button", { name: "Connect Stripe" }).click();
  await expect(page).toHaveURL(/\/settings\?stripe=onboarded/);
  await expect(page.getByTestId("stripe-status")).toContainText("Stripe connected");

  // --- customer
  const customerId = await addCustomer(page, "Milestone Properties — Galer Crest", "ap@rentmilestone.com");

  // --- invoice: labor (not taxed) + part (taxed at 10.35%)
  const invoiceId = await createInvoice(page, customerId, [
    { desc: "Replaced garbage disposal, unit 3B — labor", qty: "2", rate: "85" },
    { desc: "InSinkErator Badger 5 disposal", qty: "1", rate: "140", taxable: true },
  ]);
  await expect(page.getByRole("heading", { name: "Invoice #1001" })).toBeVisible();
  await expect(page.getByTestId("balance-due")).toHaveText("$324.49"); // 310 + 140*0.1035
  await expect(page.getByText("draft")).toBeVisible();

  // --- email it (captured in test mode) → status flips to sent
  await page.getByRole("button", { name: "Email invoice" }).click();
  await expect(page.getByRole("status")).toContainText("Sent to ap@rentmilestone.com");
  await expect(page.locator(".pill")).toHaveText("sent");
  const { emails } = await (await page.request.get("/api/test/reset")).json();
  expect(emails).toEqual([{ to: "ap@rentmilestone.com", subject: `Invoice #1001 from ${BUSINESS} — $324.49` }]);

  // --- PDF renders
  const pdf = await page.request.get(`/api/invoices/${invoiceId}/pdf`);
  expect(pdf.ok()).toBe(true);
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");

  // --- customer opens the pay page (no login) and pays by card
  const url = await payLink(page);
  expect(url).toMatch(/\/pay\/[0-9a-f]{36}$/);
  const customerPage = await page.context().newPage();
  await customerPage.goto(url);
  await expect(customerPage.getByTestId("pay-amount")).toHaveText("$324.49");
  await customerPage.getByRole("button", { name: "Pay $324.49 by card" }).click();
  await expect(customerPage.getByTestId("mock-checkout")).toBeVisible();
  await customerPage.getByRole("button", { name: "Pay $324.49" }).click();
  await expect(customerPage.getByTestId("paid-banner")).toContainText("Paid", { timeout: 15_000 });
  await customerPage.close();

  // --- contractor sees it paid
  await page.goto(`/invoices/${invoiceId}`);
  await expect(page.locator(".pill").first()).toHaveText("paid");
  await expect(page.getByText("Paid online via Stripe")).toBeVisible();
  await page.goto("/dashboard");
  await expect(page.getByText("Paid this month").locator("..")).toContainText("$324.49");
  await expect(page.getByText("Outstanding").locator("..")).toContainText("$0.00");

  // --- QuickBooks exports
  const inv = await page.request.get("/api/export?type=invoices");
  expect(inv.headers()["content-disposition"]).toContain("billready-invoices-");
  const csv = await inv.text();
  expect(csv.split("\r\n")[0]).toBe(
    "Invoice No,Customer,Invoice Date,Due Date,Item(Product/Service),ItemDescription,ItemQuantity,ItemRate,ItemAmount,Taxable,Memo",
  );
  expect(csv).toContain("1001,Milestone Properties — Galer Crest,");
  expect(csv).toContain("InSinkErator Badger 5 disposal,1,140,140.00,Y");
  const pay = await (await page.request.get("/api/export?type=payments")).text();
  expect(pay).toContain("1001,Milestone Properties — Galer Crest,");
  expect(pay).toContain(",324.49,card,pi_mock_");
  const cust = await (await page.request.get("/api/export?type=customers")).text();
  expect(cust).toContain("Milestone Properties — Galer Crest,,ap@rentmilestone.com");
});

test("repeated use: five more invoices, partial check payment, edit, void, numbering stays sane", async ({ page }) => {
  const customerId = await addCustomer(page, "Jane Homeowner", "jane@example.com");
  const ids: string[] = [];
  for (let i = 0; i < 5; i++) {
    ids.push(await createInvoice(page, customerId, [{ desc: `Service call ${i + 1}`, qty: "1", rate: `${100 + i * 50}` }], "0"));
    await expect(page.getByRole("heading", { name: `Invoice #${1002 + i}` })).toBeVisible();
  }

  // partial payment by check leaves a balance and keeps status "sent"
  await page.goto(`/invoices/${ids[0]}`);
  await page.getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.locator(".pill").first()).toHaveText("sent");
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByLabel("Amount", { exact: true }).fill("40");
  await page.getByLabel("Note (check #, etc.)").fill("Check #4471");
  await submit(page, "Save payment");
  await expect(page.getByRole("status")).toContainText("Payment recorded");
  await expect(page.getByTestId("balance-due")).toHaveText("$60.00");
  await expect(page.locator(".pill").first()).toHaveText("sent");

  // second check settles it
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("60.00");
  await submit(page, "Save payment");
  await expect(page.locator(".pill").first()).toHaveText("paid");

  // editing a draft recomputes totals
  await page.goto(`/invoices/${ids[1]}/edit`);
  await page.getByLabel("Line 1 rate").fill("999");
  await page.getByRole("button", { name: "+ Add line" }).click();
  await page.getByLabel("Line 2 description").fill("Trip charge");
  await page.getByLabel("Line 2 rate").fill("45");
  await submit(page, "Save changes");
  await expect(page.getByTestId("balance-due")).toHaveText("$1,044.00");

  // void: no longer payable
  await page.goto(`/invoices/${ids[2]}`);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Void invoice" }).click();
  await expect(page.locator(".pill").first()).toHaveText("void");
  await expect(page.getByRole("button", { name: "Email invoice" })).toHaveCount(0);

  // the list shows everything, newest first, and the export skips drafts + voids
  await page.goto("/invoices");
  const rows = page.getByRole("main").getByRole("listitem");
  await expect(rows).toHaveCount(6); // 1 from the first test + 5 here
  await expect(rows.first()).toContainText("#1006");
  const csv = await (await page.request.get("/api/export?type=invoices")).text();
  expect(csv).toContain("1002,Jane Homeowner");
  expect(csv).not.toContain("1004,Jane Homeowner"); // voided
  expect(csv).not.toContain("1005,Jane Homeowner"); // still draft

  // a stale/duplicate webhook replay must not double-pay
  const replay = { id: "evt_replay_1", type: "checkout.session.completed", data: { object: { id: "cs_r", payment_status: "paid", amount_total: 4000, payment_intent: "pi_replay", metadata: { invoice_id: ids[0] } } } };
  const r1 = await (await page.request.post("/api/stripe/webhook", { data: replay })).json();
  const r2 = await (await page.request.post("/api/stripe/webhook", { data: replay })).json();
  expect(r1.handled).toBe(true);
  expect(r2.note).toBe("duplicate event");
  await page.goto(`/invoices/${ids[0]}`);
  await expect(page.getByText("$40.00")).toHaveCount(2); // one check for $40 + one card $40, not three
});

test("a stranger can't see the pay page or PDF without the token", async ({ page }) => {
  const r = await page.request.get("/pay/not-a-real-token");
  expect(r.status()).toBe(404);
  const pdf = await page.request.get("/api/invoices/00000000-0000-0000-0000-000000000000/pdf?token=bogus");
  expect(pdf.status()).toBe(404);
});
