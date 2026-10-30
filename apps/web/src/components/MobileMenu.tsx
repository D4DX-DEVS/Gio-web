"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { NavItem } from "@/lib/content";
import { SocialIcon } from "./Icons";

export function MobileMenu({ nav, social }: { nav: NavItem[]; social: NavItem[] }) {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpenOn(open ? null : pathname)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        className="rounded-full p-2 text-ink transition hover:bg-brand-50 active:scale-95"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-(--header-h) z-50 animate-fade-in overflow-y-auto bg-white px-5 pb-8 pt-2">
          <ul className="divide-y divide-line">
            {nav.map((item) => (
              <li key={item.id} className="py-0.5">
                {item.children.length ? (
                  <details className="group" open>
                    <summary className="flex cursor-pointer list-none items-center justify-between py-2.5 text-base font-medium">{item.label}</summary>
                    <ul className="mb-2 ml-2 border-l-2 border-brand-100 pl-4">
                      {item.children.map((c) => (
                        <li key={c.id}>
                          <Link href={c.url ?? "/"} onClick={() => setOpenOn(null)} className="block py-1.5 text-[0.9375rem] text-muted hover:text-brand-700">
                            {c.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <Link href={item.url ?? "/"} onClick={() => setOpenOn(null)} className="block py-2.5 text-base font-medium hover:text-brand-700">
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
            <li className="py-0.5">
              <Link href="/search/" onClick={() => setOpenOn(null)} className="block py-2.5 text-base font-medium hover:text-brand-700">
                Search
              </Link>
            </li>
          </ul>
          <div className="mt-5 flex gap-2.5">
            {social.map((s) => (
              <a key={s.id} href={s.url ?? "#"} target="_blank" rel="noopener noreferrer" aria-label={s.label} className="rounded-full bg-brand-50 p-2.5 text-brand-700 transition hover:bg-brand-600 hover:text-white active:scale-95">
                <SocialIcon name={s.icon} className="h-5 w-5" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
