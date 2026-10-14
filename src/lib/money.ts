/** Round to cents, avoiding float drift (0.1 + 0.2 problems). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function toCents(n: number): number {
  return Math.round(round2(n) * 100);
}

export function fmtMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export interface TotalsInput {
  lines: { quantity: number; rate: number; taxable: boolean }[];
  taxRate: number; // e.g. 0.1025 for 10.25%
}

export function computeTotals({ lines, taxRate }: TotalsInput) {
  let subtotal = 0;
  let taxable = 0;
  const amounts = lines.map((l) => {
    const amt = round2(l.quantity * l.rate);
    subtotal = round2(subtotal + amt);
    if (l.taxable) taxable = round2(taxable + amt);
    return amt;
  });
  const tax_amount = round2(taxable * taxRate);
  const total = round2(subtotal + tax_amount);
  return { amounts, subtotal, tax_amount, total };
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Format 2026-10-14 as 10/14/2026 (what QuickBooks Online expects by default). */
export function fmtDateUS(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}
