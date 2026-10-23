import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Contractor } from "@/lib/types";

const calls = vi.hoisted(() => ({
  create: vi.fn(),
  retrieve: vi.fn(),
  link: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class FakeStripe {
    v2 = { core: { accounts: { create: calls.create, retrieve: calls.retrieve }, accountLinks: { create: calls.link } } };
  },
}));

const contractor = {
  id: "c1",
  business_name: "Joe's Plumbing",
  email: "joe@example.com",
  stripe_account_id: null,
} as unknown as Contractor;

describe("Stripe Connect (Accounts v2)", () => {
  beforeEach(() => {
    vi.stubEnv("BILLREADY_TEST_MODE", "0");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com/");
    calls.create.mockReset().mockResolvedValue({ id: "acct_new" });
    calls.retrieve.mockReset();
    calls.link.mockReset().mockResolvedValue({ url: "https://connect.stripe.com/setup/abc" });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("creates a v2 recipient account and returns a hosted onboarding link", async () => {
    const { createConnectOnboardingLink } = await import("@/lib/stripe");
    const out = await createConnectOnboardingLink(contractor);
    expect(out).toEqual({ accountId: "acct_new", url: "https://connect.stripe.com/setup/abc" });
    const args = calls.create.mock.calls[0][0];
    expect(args.configuration.recipient.capabilities.stripe_balance.stripe_transfers.requested).toBe(true);
    expect(args.metadata.contractor_id).toBe("c1");
    expect(calls.link.mock.calls[0][0].use_case.account_onboarding.return_url).toBe("https://app.example.com/settings?stripe=return");
  });

  it("reuses an existing account instead of creating a second one", async () => {
    const { createConnectOnboardingLink } = await import("@/lib/stripe");
    const out = await createConnectOnboardingLink({ ...contractor, stripe_account_id: "acct_old" });
    expect(out.accountId).toBe("acct_old");
    expect(calls.create).not.toHaveBeenCalled();
  });

  it("propagates Stripe errors so the action can show a message", async () => {
    calls.create.mockRejectedValue(new Error("boom"));
    const { createConnectOnboardingLink } = await import("@/lib/stripe");
    await expect(createConnectOnboardingLink(contractor)).rejects.toThrow("boom");
  });

  it("is onboarded only when stripe_transfers is active", async () => {
    const { isAccountOnboarded } = await import("@/lib/stripe");
    const acct = (status: string) => ({ configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { status } } } } } });
    calls.retrieve.mockResolvedValueOnce(acct("active"));
    expect(await isAccountOnboarded("acct_1")).toBe(true);
    calls.retrieve.mockResolvedValueOnce(acct("pending"));
    expect(await isAccountOnboarded("acct_1")).toBe(false);
    calls.retrieve.mockResolvedValueOnce({});
    expect(await isAccountOnboarded("acct_1")).toBe(false);
  });
});
