export const dynamic = "force-dynamic";
import { requireContractor } from "@/lib/auth";
import { BottomNav } from "@/components/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { contractor } = await requireContractor();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-10 bg-navy text-cream">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <span className="truncate font-[family-name:var(--font-playfair)] text-lg">{contractor.business_name}</span>
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-cream/70">Bill Ready</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
