import type { InvoiceStatus } from "@/lib/types";

const styles: Record<InvoiceStatus, string> = {
  draft: "bg-cream text-muted",
  sent: "bg-navy/10 text-navy",
  paid: "bg-evergreen/10 text-evergreen",
  overdue: "bg-amber/20 text-brick",
  void: "bg-cream text-muted line-through",
};

export function StatusPill({ status, dueDate }: { status: InvoiceStatus; dueDate?: string }) {
  let s: InvoiceStatus = status;
  if (s === "sent" && dueDate && dueDate < new Date().toISOString().slice(0, 10)) s = "overdue";
  return <span className={`pill ${styles[s]}`}>{s}</span>;
}
