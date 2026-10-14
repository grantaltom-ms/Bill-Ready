import { Resend } from "resend";
import { isTestMode } from "@/lib/db";
import { fmtMoney, fmtDateUS } from "@/lib/money";
import type { Contractor, InvoiceWithDetails } from "@/lib/types";

declare global {
  var __billreadySentEmails: { to: string; subject: string; html: string }[] | undefined;
}

/** In test mode, emails are captured here instead of sent. */
export function sentEmails() {
  if (!globalThis.__billreadySentEmails) globalThis.__billreadySentEmails = [];
  return globalThis.__billreadySentEmails;
}

export async function sendInvoiceEmail(
  inv: InvoiceWithDetails & { contractor: Contractor },
  payUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const to = inv.customer.email;
  if (!to) return { ok: false, error: "Customer has no email address" };
  const due = inv.total - inv.amount_paid;
  const subject = `Invoice #${inv.invoice_number} from ${inv.contractor.business_name} — ${fmtMoney(due)}`;
  const html = `
    <div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
      <h2 style="margin:0 0 8px">${esc(inv.contractor.business_name)}</h2>
      <p style="margin:0 0 20px;color:#555">Invoice #${inv.invoice_number} · Due ${fmtDateUS(inv.due_date)}</p>
      <p>Hi ${esc(inv.customer.display_name)},</p>
      <p>Here is your invoice for <strong>${fmtMoney(due)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        ${inv.lines
          .map(
            (l) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(l.description)}</td>
                    <td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${fmtMoney(l.amount)}</td></tr>`,
          )
          .join("")}
        <tr><td style="padding:8px 0;font-weight:600">Total</td><td style="padding:8px 0;text-align:right;font-weight:600">${fmtMoney(inv.total)}</td></tr>
      </table>
      <p style="margin:24px 0"><a href="${payUrl}" style="background:#0f766e;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">View &amp; pay invoice</a></p>
      ${inv.notes ? `<p style="color:#555">${esc(inv.notes)}</p>` : ""}
      <p style="color:#888;font-size:13px">${esc(inv.contractor.business_name)}${inv.contractor.phone ? " · " + esc(inv.contractor.phone) : ""}${inv.contractor.email ? " · " + esc(inv.contractor.email) : ""}</p>
    </div>`;

  if (isTestMode) {
    sentEmails().push({ to, subject, html });
    return { ok: true };
  }
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "RESEND_API_KEY is not set" };
  const from = process.env.EMAIL_FROM ?? "Bill Ready <invoices@example.com>";
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from,
    to,
    replyTo: inv.contractor.email ?? undefined,
    subject,
    html,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
