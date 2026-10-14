"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { saveInvoiceAction, type ActionResult } from "@/app/actions";
import { FormMessage, SubmitButton } from "@/components/forms";
import { computeTotals, fmtMoney } from "@/lib/money";
import type { Customer, InvoiceWithDetails } from "@/lib/types";

interface LineState {
  key: number;
  description: string;
  quantity: string;
  rate: string;
  taxable: boolean;
}

export function InvoiceForm({
  customers,
  invoice,
  defaults,
}: {
  customers: Customer[];
  invoice?: InvoiceWithDetails;
  defaults: { customer_id: string; issue_date: string; due_date: string; tax_rate_pct: number };
}) {
  const [result, action] = useActionState<ActionResult | null, FormData>(saveInvoiceAction, null);
  const [lines, setLines] = useState<LineState[]>(() =>
    invoice && invoice.lines.length
      ? invoice.lines.map((l, i) => ({ key: i, description: l.description, quantity: String(l.quantity), rate: String(l.rate), taxable: l.taxable }))
      : [{ key: 0, description: "", quantity: "1", rate: "", taxable: false }],
  );
  const [taxPct, setTaxPct] = useState(String(invoice ? invoice.tax_rate * 100 : defaults.tax_rate_pct));

  const totals = useMemo(
    () =>
      computeTotals({
        lines: lines.map((l) => ({ quantity: Number(l.quantity) || 0, rate: Number(l.rate) || 0, taxable: l.taxable })),
        taxRate: (Number(taxPct) || 0) / 100,
      }),
    [lines, taxPct],
  );

  const update = (key: number, patch: Partial<LineState>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, { key: Date.now(), description: "", quantity: "1", rate: "", taxable: false }]);
  const removeLine = (key: number) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));

  return (
    <form action={action} className="space-y-5">
      {invoice && <input type="hidden" name="id" value={invoice.id} />}

      <div>
        <label htmlFor="customer_id">Customer</label>
        <div className="flex gap-2">
          <select id="customer_id" name="customer_id" required defaultValue={invoice?.customer_id ?? defaults.customer_id}>
            <option value="">Choose a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.display_name}
                {c.company ? ` — ${c.company}` : ""}
              </option>
            ))}
          </select>
          <Link href="/customers/new?next=/invoices/new" className="btn-secondary shrink-0 px-3" aria-label="Add new customer">
            +
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="issue_date">Invoice date</label>
          <input id="issue_date" name="issue_date" type="date" required defaultValue={invoice?.issue_date ?? defaults.issue_date} />
        </div>
        <div>
          <label htmlFor="due_date">Due date</label>
          <input id="due_date" name="due_date" type="date" required defaultValue={invoice?.due_date ?? defaults.due_date} />
        </div>
      </div>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium text-muted">Line items</legend>
        {lines.map((l, i) => (
          <div key={l.key} className="card space-y-2" data-testid="line-item">
            <input
              name="line_description"
              aria-label={`Line ${i + 1} description`}
              placeholder="Replaced garbage disposal, unit 3B"
              value={l.description}
              onChange={(e) => update(l.key, { description: e.target.value })}
            />
            <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <div>
                <label className="text-xs">Qty</label>
                <input
                  name="line_quantity"
                  aria-label={`Line ${i + 1} quantity`}
                  type="number"
                  inputMode="decimal"
                  step="0.25"
                  min="0"
                  value={l.quantity}
                  onChange={(e) => update(l.key, { quantity: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs">Rate</label>
                <input
                  name="line_rate"
                  aria-label={`Line ${i + 1} rate`}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={l.rate}
                  onChange={(e) => update(l.key, { rate: e.target.value })}
                />
              </div>
              <div className="pb-2 text-right font-semibold tabular-nums">{fmtMoney(totals.amounts[i] ?? 0)}</div>
            </div>
            <div className="flex items-center justify-between">
              <label className="mb-0 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="line_taxable"
                  value={String(i)}
                  className="h-4 w-4"
                  checked={l.taxable}
                  onChange={(e) => update(l.key, { taxable: e.target.checked })}
                />
                Taxable
              </label>
              <button type="button" onClick={() => removeLine(l.key)} className="text-sm text-muted" aria-label={`Remove line ${i + 1}`}>
                Remove
              </button>
            </div>
          </div>
        ))}
        <button type="button" onClick={addLine} className="btn-secondary w-full">
          + Add line
        </button>
      </fieldset>

      <div className="card space-y-2 text-sm">
        <Row label="Subtotal" value={fmtMoney(totals.subtotal)} />
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="tax_rate" className="mb-0 flex items-center gap-2 text-sm">
            Sales tax
            <input
              id="tax_rate"
              name="tax_rate"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              className="w-20 py-1"
              value={taxPct}
              onChange={(e) => setTaxPct(e.target.value)}
            />
            %
          </label>
          <span className="tabular-nums">{fmtMoney(totals.tax_amount)}</span>
        </div>
        <Row label="Total" value={fmtMoney(totals.total)} bold />
      </div>

      <div>
        <label htmlFor="notes">Notes to customer</label>
        <textarea id="notes" name="notes" rows={2} defaultValue={invoice?.notes ?? ""} placeholder="Thanks for your business. Net 30." />
      </div>

      <FormMessage result={result} />
      <SubmitButton>{invoice ? "Save changes" : "Save invoice"}</SubmitButton>
    </form>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums" data-testid={bold ? "total" : undefined}>
        {value}
      </span>
    </div>
  );
}
