import { describe, expect, it } from "vitest";
import { friendlyAuthError, loginErrorMessage } from "@/lib/auth-messages";

describe("auth messages", () => {
  it("explains Supabase rate limits in plain words", () => {
    expect(friendlyAuthError("email rate limit exceeded")).toMatch(/Too many sign-in emails/);
    expect(friendlyAuthError("For security purposes, you can only request this after 24 seconds.")).toMatch(/Too many/);
  });
  it("passes other errors through", () => {
    expect(friendlyAuthError("Signups not allowed")).toBe("Signups not allowed");
  });
  it("explains a failed link click", () => {
    expect(loginErrorMessage("link")).toMatch(/same device/);
    expect(loginErrorMessage(undefined)).toBeNull();
  });
});
