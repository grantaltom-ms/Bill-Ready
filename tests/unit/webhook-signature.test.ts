import { afterEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";

describe("webhook signature verification (production mode)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load() {
    vi.stubEnv("BILLREADY_TEST_MODE", "0");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_platform");
    vi.stubEnv("STRIPE_CONNECT_WEBHOOK_SECRET", "whsec_connect");
    return import("@/lib/stripe");
  }
  const body = JSON.stringify({ id: "evt_x", type: "account.updated", data: { object: {} } });
  const sign = (secret: string) => Stripe.webhooks.generateTestHeaderString({ payload: body, secret });

  it("accepts events signed with the platform secret", async () => {
    const { parseWebhookEvent } = await load();
    expect(parseWebhookEvent(body, sign("whsec_platform")).id).toBe("evt_x");
  });
  it("accepts events signed with the connected-accounts secret", async () => {
    const { parseWebhookEvent } = await load();
    expect(parseWebhookEvent(body, sign("whsec_connect")).id).toBe("evt_x");
  });
  it("rejects anything else", async () => {
    const { parseWebhookEvent } = await load();
    expect(() => parseWebhookEvent(body, sign("whsec_attacker"))).toThrow();
    expect(() => parseWebhookEvent(body, null)).toThrow();
  });
});
