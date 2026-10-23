import { CustomerForm } from "@/components/customer-form";

export default async function NewCustomerPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-medium">New customer</h1>
      <CustomerForm next={next} />
    </div>
  );
}
