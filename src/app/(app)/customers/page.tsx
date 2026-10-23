import Link from "next/link";
import { requireContractor } from "@/lib/auth";
import { getStore } from "@/lib/db";

export default async function CustomersPage() {
  const { contractor } = await requireContractor();
  const customers = await getStore().listCustomers(contractor.id);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-medium">Customers</h1>
        <Link href="/customers/new" className="btn-primary">
          Add customer
        </Link>
      </div>
      {customers.length === 0 ? (
        <p className="card text-sm text-muted">No customers yet. Add the people you bill — landlords, property managers, homeowners.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-card">
          {customers.map((c) => (
            <li key={c.id}>
              <Link href={`/customers/${c.id}`} className="block px-4 py-3">
                <p className="font-medium">{c.display_name}</p>
                <p className="text-xs text-muted">{[c.company, c.email, c.phone].filter(Boolean).join(" · ") || "No contact info"}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
