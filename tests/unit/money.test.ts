import { describe, expect, it } from "vitest";
import { addDaysISO, computeTotals, fmtDateUS, round2, toCents } from "@/lib/money";

describe("money", () => {
  it("rounds without float drift", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
    expect(toCents(19.99)).toBe(1999);
  });

  it("computes totals with tax only on taxable lines", () => {
    const t = computeTotals({
      lines: [
        { quantity: 2, rate: 85, taxable: false }, // labor 170
        { quantity: 1, rate: 140, taxable: true }, // part 140
      ],
      taxRate: 0.1035,
    });
    expect(t.amounts).toEqual([170, 140]);
    expect(t.subtotal).toBe(310);
    expect(t.tax_amount).toBe(14.49);
    expect(t.total).toBe(324.49);
  });

  it("handles fractional quantities", () => {
    const t = computeTotals({ lines: [{ quantity: 1.75, rate: 95, taxable: false }], taxRate: 0 });
    expect(t.subtotal).toBe(166.25);
  });

  it("formats dates for QuickBooks and adds days", () => {
    expect(fmtDateUS("2026-10-14")).toBe("10/14/2026");
    expect(addDaysISO("2026-10-14", 30)).toBe("2026-11-13");
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
  });
});
