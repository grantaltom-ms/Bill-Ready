export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getStore } from "@/lib/db";
import { renderInvoicePdf } from "@/lib/pdf";

export const runtime = "nodejs";

/**
 * PDF of one invoice. Two ways in:
 *  - signed-in contractor (their own invoices), or
 *  - ?token=<public_token> from the customer's pay page.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("token");
  const store = getStore();

  let inv = null;
  if (token) {
    const byToken = await store.getInvoiceByToken(token);
    if (byToken && byToken.id === id) inv = byToken;
  } else {
    const user = await store.currentUser();
    const contractor = user ? await store.contractorForUser(user.id) : null;
    const own = contractor ? await store.getInvoice(contractor.id, id) : null;
    if (own && contractor) inv = { ...own, contractor };
  }
  if (!inv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await renderInvoicePdf(inv);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="invoice-${inv.invoice_number}.pdf"`,
    },
  });
}
