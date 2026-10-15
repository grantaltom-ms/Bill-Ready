import { z } from "zod";

/** What the contractor said, turned into something the invoice form can show. */
export interface DraftLine {
  description: string;
  quantity: number;
  rate: number;
  taxable: boolean;
}

export interface VoiceDraft {
  customer_id: string | null;
  customer_name: string;
  notes: string;
  lines: DraftLine[];
  warnings: string[];
}

type CustomerLike = { id: string; display_name: string; company: string | null };

/** Model output is untrusted: coerce numbers, default missing fields, drop blanks. */
const rawSchema = z.object({
  customer_name: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  lines: z
    .array(
      z.object({
        description: z.string().optional().default(""),
        quantity: z.coerce.number().optional().default(1),
        rate: z.coerce.number().optional().default(0),
        taxable: z.boolean().optional().default(false),
      }),
    )
    .optional()
    .default([]),
});

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Find the customer the contractor meant: exact name first, then a single loose match. */
export function matchCustomer<T extends CustomerLike>(heard: string, customers: T[]): T | null {
  const want = norm(heard);
  if (!want) return null;
  const exact = customers.find((c) => norm(c.display_name) === want || (c.company !== null && norm(c.company) === want));
  if (exact) return exact;
  const loose = customers.filter((c) => {
    const n = norm(c.display_name);
    return n !== "" && (n.includes(want) || want.includes(n));
  });
  return loose.length === 1 ? loose[0] : null;
}

export function normalizeDraft(raw: unknown, customers: CustomerLike[]): VoiceDraft {
  const parsed = rawSchema.safeParse(raw);
  if (!parsed.success) throw new Error("The draft came back in a shape I couldn't read");
  const data = parsed.data;
  const warnings: string[] = [];

  const lines: DraftLine[] = [];
  data.lines.forEach((l) => {
    const description = l.description.trim();
    if (!description) return;
    const n = lines.length + 1;
    if (!(l.rate > 0)) warnings.push(`Line ${n} (${description}) has no price. Fill it in before saving.`);
    if (!(l.quantity > 0)) warnings.push(`Line ${n} had no quantity, so it's set to 1. Check it.`);
    lines.push({
      description,
      quantity: l.quantity > 0 ? l.quantity : 1,
      rate: Math.max(0, l.rate || 0),
      taxable: l.taxable,
    });
  });

  const heard = data.customer_name.trim();
  const match = heard ? matchCustomer(heard, customers) : null;
  if (!heard) warnings.push("I didn't hear a customer name. Pick one below.");
  else if (!match) warnings.push(`No customer named "${heard}". Pick one below, or add them first.`);
  if (lines.length === 0) warnings.push("No line items came through. Try again, or type them in.");

  return {
    customer_id: match?.id ?? null,
    customer_name: heard,
    notes: data.notes.trim(),
    lines,
    warnings,
  };
}
