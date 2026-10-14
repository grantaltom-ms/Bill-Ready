export const dynamic = "force-dynamic";
import { requireContractor } from "@/lib/auth";
import { BottomNav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { contractor } = await requireContractor();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-line bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <span className="truncate font-semibold">{contractor.business_name}</span>
          <span className="text-xs text-muted">Bill Ready</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
