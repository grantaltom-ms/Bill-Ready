import type { InvoiceStatus } from "@/lib/types";

const styles: Record<InvoiceStatus, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-50 text-blue-700",
  paid: "bg-green-50 text-ok",
  overdue: "bg-orange-50 text-warn",
  void: "bg-gray-100 text-gray-500 line-through",
};

export function StatusPill({ status, dueDate }: { status: InvoiceStatus; dueDate?: string }) {
  let s: InvoiceStatus = status;
  if (s === "sent" && dueDate && dueDate < new Date().toISOString().slice(0, 10)) s = "overdue";
  return <span className={`pill ${styles[s]}`}>{s}</span>;
}
