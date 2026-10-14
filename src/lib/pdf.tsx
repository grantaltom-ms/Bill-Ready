import React from "react";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { fmtDateUS, fmtMoney } from "@/lib/money";
import type { Contractor, InvoiceWithDetails } from "@/lib/types";

const s = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#16211f" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold" },
  muted: { color: "#5d6b67" },
  section: { marginTop: 18 },
  th: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#16211f", paddingBottom: 4, fontFamily: "Helvetica-Bold" },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e2e6e3", paddingVertical: 5 },
  cDesc: { flex: 1 },
  cNum: { width: 60, textAlign: "right" },
  cAmt: { width: 80, textAlign: "right" },
  totals: { marginTop: 10, alignSelf: "flex-end", width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  bold: { fontFamily: "Helvetica-Bold" },
  badge: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#0f766e" },
});

export function InvoicePdf({ inv }: { inv: InvoiceWithDetails & { contractor: Contractor } }) {
  const c = inv.contractor;
  const due = inv.total - inv.amount_paid;
  return (
    <Document title={`Invoice ${inv.invoice_number}`}>
      <Page size="LETTER" style={s.page}>
        <View style={s.row}>
          <View>
            <Text style={s.h1}>{c.business_name}</Text>
            {c.address ? <Text style={s.muted}>{c.address}</Text> : null}
            <Text style={s.muted}>{[c.phone, c.email].filter(Boolean).join("  ·  ")}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={s.h1}>INVOICE</Text>
            <Text>#{inv.invoice_number}</Text>
            <Text style={s.muted}>Date: {fmtDateUS(inv.issue_date)}</Text>
            <Text style={s.muted}>Due: {fmtDateUS(inv.due_date)}</Text>
            {inv.status === "paid" ? <Text style={s.badge}>PAID</Text> : null}
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.bold}>Bill to</Text>
          <Text>{inv.customer.display_name}</Text>
          {inv.customer.company ? <Text>{inv.customer.company}</Text> : null}
          {inv.customer.billing_address ?? inv.customer.service_address ? (
            <Text style={s.muted}>{inv.customer.billing_address ?? inv.customer.service_address}</Text>
          ) : null}
          {inv.customer.service_address && inv.customer.billing_address ? (
            <Text style={s.muted}>Service address: {inv.customer.service_address}</Text>
          ) : null}
        </View>

        <View style={s.section}>
          <View style={s.th}>
            <Text style={s.cDesc}>Description</Text>
            <Text style={s.cNum}>Qty</Text>
            <Text style={s.cAmt}>Rate</Text>
            <Text style={s.cAmt}>Amount</Text>
          </View>
          {inv.lines.map((l) => (
            <View key={l.id} style={s.tr}>
              <Text style={s.cDesc}>{l.description}{l.taxable ? "  (T)" : ""}</Text>
              <Text style={s.cNum}>{l.quantity}</Text>
              <Text style={s.cAmt}>{fmtMoney(l.rate)}</Text>
              <Text style={s.cAmt}>{fmtMoney(l.amount)}</Text>
            </View>
          ))}
          <View style={s.totals}>
            <View style={s.totalRow}><Text>Subtotal</Text><Text>{fmtMoney(inv.subtotal)}</Text></View>
            <View style={s.totalRow}><Text>Tax ({(inv.tax_rate * 100).toFixed(2)}%)</Text><Text>{fmtMoney(inv.tax_amount)}</Text></View>
            <View style={[s.totalRow, s.bold]}><Text>Total</Text><Text>{fmtMoney(inv.total)}</Text></View>
            {inv.amount_paid > 0 ? (
              <>
                <View style={s.totalRow}><Text>Paid</Text><Text>-{fmtMoney(inv.amount_paid)}</Text></View>
                <View style={[s.totalRow, s.bold]}><Text>Balance due</Text><Text>{fmtMoney(due)}</Text></View>
              </>
            ) : null}
          </View>
        </View>

        {inv.notes ? (
          <View style={s.section}>
            <Text style={s.bold}>Notes</Text>
            <Text>{inv.notes}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(inv: InvoiceWithDetails & { contractor: Contractor }): Promise<Buffer> {
  return renderToBuffer(<InvoicePdf inv={inv} />);
}
