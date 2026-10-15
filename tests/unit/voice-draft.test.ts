import { describe, expect, it } from "vitest";
import { matchCustomer, normalizeDraft } from "@/lib/voice/draft";

const customers = [
  { id: "c1", display_name: "Henderson Rentals", company: "Henderson Properties LLC" },
  { id: "c2", display_name: "Lakeview Apartments", company: null },
  { id: "c3", display_name: "Lakeview Townhomes", company: null },
];

describe("matchCustomer", () => {
  it("matches the display name regardless of case and punctuation", () => {
    expect(matchCustomer("henderson  rentals.", customers)?.id).toBe("c1");
  });
  it("matches the company name", () => {
    expect(matchCustomer("Henderson Properties LLC", customers)?.id).toBe("c1");
  });
  it("accepts a single loose match", () => {
    expect(matchCustomer("Henderson", customers)?.id).toBe("c1");
  });
  it("refuses to guess when a loose match is ambiguous", () => {
    expect(matchCustomer("Lakeview", customers)).toBeNull();
  });
  it("returns nothing for an unknown or empty name", () => {
    expect(matchCustomer("Nobody Here", customers)).toBeNull();
    expect(matchCustomer("   ", customers)).toBeNull();
  });
});

describe("normalizeDraft", () => {
  it("turns a clean model result into form lines and a matched customer", () => {
    const d = normalizeDraft(
      {
        customer_name: "Henderson Rentals",
        notes: "Net 30",
        lines: [
          { description: "Labor", quantity: 2, rate: 85, taxable: false },
          { description: "Garbage disposal", quantity: 1, rate: 120, taxable: true },
        ],
      },
      customers,
    );
    expect(d.customer_id).toBe("c1");
    expect(d.notes).toBe("Net 30");
    expect(d.lines).toEqual([
      { description: "Labor", quantity: 2, rate: 85, taxable: false },
      { description: "Garbage disposal", quantity: 1, rate: 120, taxable: true },
    ]);
    expect(d.warnings).toEqual([]);
  });

  it("coerces numbers given as strings and fills missing fields", () => {
    const d = normalizeDraft({ lines: [{ description: "Faucet", quantity: "3", rate: "40" }] }, customers);
    expect(d.lines[0]).toEqual({ description: "Faucet", quantity: 3, rate: 40, taxable: false });
    expect(d.customer_id).toBeNull();
  });

  it("drops blank lines and flags a line with no price", () => {
    const d = normalizeDraft(
      { customer_name: "Lakeview Townhomes", lines: [{ description: "  ", rate: 50 }, { description: "Paint touch-up", quantity: 1, rate: 0 }] },
      customers,
    );
    expect(d.lines.map((l) => l.description)).toEqual(["Paint touch-up"]);
    expect(d.warnings.some((w) => w.includes("Line 1 (Paint touch-up) has no price"))).toBe(true);
    expect(d.customer_id).toBe("c3");
  });

  it("sets a zero or negative quantity to 1 and warns", () => {
    const d = normalizeDraft({ customer_name: "Lakeview Townhomes", lines: [{ description: "Trip charge", quantity: 0, rate: 30 }] }, customers);
    expect(d.lines[0].quantity).toBe(1);
    expect(d.warnings.some((w) => w.includes("no quantity"))).toBe(true);
  });

  it("warns when the customer is unknown and keeps the name heard", () => {
    const d = normalizeDraft({ customer_name: "Sunset Condos", lines: [{ description: "Fob", quantity: 1, rate: 15 }] }, customers);
    expect(d.customer_id).toBeNull();
    expect(d.customer_name).toBe("Sunset Condos");
    expect(d.warnings).toContain('No customer named "Sunset Condos". Pick one below, or add them first.');
  });

  it("warns when nothing usable came through", () => {
    const d = normalizeDraft({ customer_name: "", lines: [] }, customers);
    expect(d.lines).toEqual([]);
    expect(d.warnings).toContain("I didn't hear a customer name. Pick one below.");
    expect(d.warnings.some((w) => w.startsWith("No line items"))).toBe(true);
  });

  it("rejects output that isn't an object at all", () => {
    expect(() => normalizeDraft("nonsense", customers)).toThrow(/couldn't read/);
  });
});
