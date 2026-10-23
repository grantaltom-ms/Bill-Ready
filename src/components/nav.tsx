"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, FileText, Plus, Users, Settings } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Home", Icon: House },
  { href: "/invoices", label: "Invoices", Icon: FileText },
  { href: "/invoices/new", label: "New", Icon: Plus, primary: true },
  { href: "/customers", label: "Customers", Icon: Users },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
        {items.map(({ Icon, ...it }) => {
          const active = it.href === "/invoices" ? path === "/invoices" || /^\/invoices\/(?!new)/.test(path) : path.startsWith(it.href);
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={
                  it.primary
                    ? "mx-auto my-1.5 flex h-11 w-11 items-center justify-center rounded bg-evergreen text-accent-ink transition-colors hover:bg-moss"
                    : `flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors hover:text-amber ${active ? "text-evergreen" : "text-muted"}`
                }
              >
                <Icon aria-hidden size={it.primary ? 22 : 20} strokeWidth={1.75} />
                {!it.primary && it.label}
                {it.primary && <span className="sr-only">{it.label} invoice</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
