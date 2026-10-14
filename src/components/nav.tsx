"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Home", icon: "⌂" },
  { href: "/invoices", label: "Invoices", icon: "▤" },
  { href: "/invoices/new", label: "New", icon: "+", primary: true },
  { href: "/customers", label: "Customers", icon: "☺" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
        {items.map((it) => {
          const active = it.href === "/invoices" ? path === "/invoices" || /^\/invoices\/(?!new)/.test(path) : path.startsWith(it.href);
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={
                  it.primary
                    ? "mx-auto my-1.5 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-2xl font-bold text-accent-ink shadow"
                    : `flex flex-col items-center gap-0.5 py-2 text-[11px] ${active ? "text-accent" : "text-muted"}`
                }
              >
                <span aria-hidden className={it.primary ? "" : "text-lg leading-none"}>{it.icon}</span>
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
