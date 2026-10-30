"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ items }: { items: { href: string; label: string; group?: string }[] }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/admin/" ? pathname === "/admin" || pathname === "/admin/" : pathname.startsWith(href.replace(/\/$/, "")));
  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 text-sm [scrollbar-color:rgb(255_255_255/0.12)_transparent] [scrollbar-width:thin] hover:[scrollbar-color:rgb(255_255_255/0.3)_transparent] lg:min-h-0 lg:flex-1 lg:flex-col lg:overflow-y-auto lg:overflow-x-visible lg:pb-6">
      {items.map((i) => (
        <div key={i.href} className="contents">
          {i.group ? <span className="hidden px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-300 lg:block">{i.group}</span> : null}
          <Link
            href={i.href}
            aria-current={active(i.href) ? "page" : undefined}
            className={`whitespace-nowrap rounded-lg px-3 py-2 transition duration-200 ${active(i.href) ? "bg-white/15 font-semibold text-white shadow-inner" : "text-brand-100 hover:translate-x-0.5 hover:bg-white/10 hover:text-white"}`}
          >
            {i.label}
          </Link>
        </div>
      ))}
    </nav>
  );
}
